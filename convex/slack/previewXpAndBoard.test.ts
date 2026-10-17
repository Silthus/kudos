import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, type SlackCall } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, setWorkspaceSettings, testBackend, type Backend } from "../../testing/slackBackend";
import { type BlockAction, blockActions, buttonInHome, channelPickerInHome, publishedHome } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, slashCommandResponseUrl } from "../../testing/slackMessages";
import type { QueryCtx } from "../_generated/server";
import { isOnTheBoards } from "../leaderboard/visibility";
import { standingOf } from "../progression/progression";
import { notificationSwitchesOf } from "../messageSettings/messageSettings";
import { settingsOf } from "../workspace/settings";

const now = new Date("2026-10-13T10:00:00Z");
const xpLevels = "xp-levels";
const everyoneBoard = "everyone-board";
const alicesEmail = "alice@example.com";

const previewedByAlice = [onForEmails(xpLevels, alicesEmail), onForEmails(everyoneBoard, alicesEmail)];
const offForEveryoneElse = [offForEveryone(xpLevels), offForEveryone(everyoneBoard)];
const onForTheWorkspace = [onForEveryone(xpLevels), onForEveryone(everyoneBoard)];

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("F16: xp-levels and everyone-board previewed by one member's email", () => {
  test("the previewing member gets the tabs, their level, the level-up DM and the board reply", async () => {
    const t = await workspaceDeciding(...previewedByAlice);

    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")).toEqual(expect.arrayContaining(["actions: [Profile] | Leaderboard | Settings", "section fields: *Level*\n*2* | *XP to level 3*\n*80*"]));
    expect(slack.messagesIn("U_ALICE").map(({ text }) => text)).toContain("🎉 You reached level 2!\nLevel 3 is 80 XP away.");
    expect(await commandReply(t, "U_ALICE", "leaderboard")).toEqual({ status: 200, body: { response_type: "ephemeral", text: "🥇 <@U_ALICE> · 2 kudos\n▲ 2 more kudos than this time last week" } });
  });

  test("the previewing member's success reply names the XP their kudos earned them, and the other member's names none", async () => {
    const t = await workspaceDeciding(...previewedByAlice);

    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    await giveKudos(t, "U_BOB", "U_ALICE", 2);

    expect(slack.ephemeralsTo("U_ALICE").map(({ text }) => text)).toEqual(["<@U_BOB> got 2 kudos from you. You have 8 kudos left today.\n+20 XP"]);
    expect(slack.ephemeralsTo("U_BOB").map(({ text }) => text)).toEqual(["<@U_ALICE> got 2 kudos from you. You have 8 kudos left today."]);
  });

  test("the previewing member's App Home is published again after each kudos, without reopening it", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await openHome(t, "U_ALICE");

    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    expect(publishedHome(slack, "U_ALICE")).toContain("section fields: *Level*\n*2* | *XP to level 3*\n*80*");
  });

  test("the previewing member's Leaderboard and Settings clicks take effect", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");

    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Leaderboard"));
    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "This month"));
    const leaderboardTab = publishedHome(slack, "U_ALICE");
    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Settings"));
    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Turn off DMs"));
    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Off"));

    expect(leaderboardTab).toEqual(expect.arrayContaining(["actions: Profile | [Leaderboard] | Settings", "actions: This week | [This month] | All time"]));
    expect(await t.run(async (ctx) => (await notificationSwitchesOf(ctx, await memberIn(ctx, "U_ALICE"))).dms)).toBe(false);
    expect(await t.run(async (ctx) => isOnTheBoards(ctx, await memberIn(ctx, "U_ALICE")))).toBe(false);
  });

  test("the other member's Slack calls and command reply are exactly those with both flags off", async () => {
    const whilePreviewed = await bobsSideOf(previewedByAlice);
    vi.clearAllTimers();
    const whileOff = await bobsSideOf(offForEveryoneElse);

    expect(whilePreviewed).toEqual(whileOff);
  });

  test("F19: a caller the directory doesn't know gets the workspace decision, even with the previewed email, and their exposure once known is their own", async () => {
    const t = await workspaceDeciding(...previewedByAlice);

    const reply = await commandReply(t, "U_ALICE", "leaderboard");
    await settle(t);

    expect(reply).toEqual({ status: 200, body: "" });
    expect(slack.callsTo("conversations.join")).toEqual([{ channel: "C1" }]);
    expect(await exposuresOf(t, "U_ALICE")).toEqual([[everyoneBoard, true]]);
  });

  test("F25: exposures carry true for the previewing member and false for the other", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);

    await openHome(t, "U_ALICE");
    await openHome(t, "U_BOB");

    expect(await exposuresOf(t, "U_ALICE")).toEqual([
      [xpLevels, true],
      ["unlocks", false],
      ["message-settings", false],
      ["groups", false],
      [everyoneBoard, true],
    ]);
    expect(await exposuresOf(t, "U_BOB")).toEqual([
      [xpLevels, false],
      ["message-settings", false],
      ["groups", false],
      [everyoneBoard, false],
    ]);
  });

  test("F24: removing the condition hides everything again and takes no XP away", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    const earned = await standing(t, "U_ALICE");

    await flagsFromPostHog(t, postHog, ...offForEveryoneElse);
    await openHome(t, "U_ALICE");

    expect(publishedHome(slack, "U_ALICE")[0]).toBe("header: Your kudos");
    expect(await commandReply(t, "U_ALICE", "leaderboard")).toEqual({ status: 200, body: "" });
    expect(await standing(t, "U_ALICE")).toEqual(earned);
  });
});

describe("F18: what a channel shows or the workspace shares follows the workspace decision", () => {
  test.each<[string, FlagDefinition[], string[]]>([
    ["the previewing member's level up posts no public notice", previewedByAlice, []],
    ["with the workspace decision on, it posts as before", onForTheWorkspace, ["🎉 <@U_ALICE> reached level 2."]],
  ])("%s", async (_, definitions, notices) => {
    const t = await workspaceDeciding(...definitions);
    await setWorkspaceSettings(t, { announcementChannel: "C_NEWS" });

    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    expect(slack.messagesIn("C_NEWS").map(({ text }) => text)).toEqual(notices);
  });

  test("a previewing admin sees no announcement-channel control, and the command refuses without writing", async () => {
    const t = await workspaceDeciding(...onForTheWorkspace);
    await openHome(t, "U_ALICE");
    await click(t, "U_ALICE", buttonInHome(slack, "U_ALICE", "Admin"));
    const pickNews = channelPickerInHome(slack, "U_ALICE", "C_NEWS");

    await flagsFromPostHog(t, postHog, ...previewedByAlice);
    await openHome(t, "U_ALICE");
    const tabs = publishedHome(slack, "U_ALICE")[0];
    await click(t, "U_ALICE", pickNews);

    expect(tabs).toBe("actions: [Profile] | Leaderboard | Settings");
    expect((await t.run((ctx) => settingsOf(ctx, "T1"))).announcementChannel).toBeNull();
  });
});

async function bobsSideOf(definitions: FlagDefinition[]) {
  const t = await workspaceDeciding(...definitions);
  await giveKudos(t, "U_ALICE", "U_BOB", 2);
  await giveKudos(t, "U_BOB", "U_ALICE", 2);
  await openHome(t, "U_ALICE");
  await openHome(t, "U_BOB");
  const reply = await commandReply(t, "U_BOB", "leaderboard");
  await settle(t);
  return { reply, calls: perConversation(slack.calls.filter((call) => !isAbout(call, "U_ALICE"))) };
}

function perConversation(calls: SlackCall[]) {
  const conversations = new Map<string, SlackCall[]>();
  for (const call of calls) {
    const conversation = String(call.args.channel ?? `${call.method} ${call.args.user_id ?? call.args.user ?? ""}`);
    conversations.set(conversation, [...(conversations.get(conversation) ?? []), call]);
  }
  return Object.fromEntries(conversations);
}

function isAbout({ args }: SlackCall, user: string) {
  return [args.user_id, args.user, args.users, args.channel].includes(user);
}

async function workspaceDeciding(...definitions: FlagDefinition[]) {
  slack = new FakeSlack()
    .withMember("U_ALICE", { is_admin: true, profile: { email: alicesEmail } })
    .withMember("U_BOB", { profile: { email: "bob@example.com" } });
  sentMessages = 0;
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return flagsFromPostHog(t, postHog, ...definitions);
}

async function giveKudos(t: Backend, giver: string, recipient: string, kudos: number) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${now.getTime() / 1000 + sentMessages}.000100` })));
  await settle(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function click(t: Backend, user: string, action: BlockAction) {
  await t.fetch("/slack/interactivity", await signedRequest(blockActions(user, action), { contentType: "application/x-www-form-urlencoded" }));
  await settle(t);
}

async function commandReply(t: Backend, user: string, text: string) {
  const body = new URLSearchParams({
    team_id: "T1",
    channel_id: "C1",
    channel_name: "general",
    user_id: user,
    command: "/hedgehug",
    text,
    response_url: slashCommandResponseUrl,
    trigger_id: "1.2.3",
  }).toString();
  const response = await t.fetch("/slack/commands", await signedRequest(body, { contentType: "application/x-www-form-urlencoded" }));
  const reply = await response.text();
  return { status: response.status, body: reply === "" ? "" : JSON.parse(reply) };
}

async function memberOf(t: Backend, user: string) {
  return t.run((ctx) => memberIn(ctx, user));
}

async function memberIn(ctx: QueryCtx, user: string) {
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
    .unique();
  return member!._id;
}

async function standing(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run((ctx) => standingOf(ctx, member));
}

async function exposuresOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const analyticsId = await t.run(async (ctx) => (await ctx.db.query("analyticsIds").withIndex("by_member", (q) => q.eq("member", member)).unique())?.analyticsId);
  const sent = postHog.events().filter(({ event, distinct_id }) => event === "$feature_flag_called" && distinct_id === analyticsId);
  const once = [...new Map(sent.map((event) => [event.uuid, event])).values()];
  return once.map(({ properties }) => [properties.$feature_flag, properties.$feature_flag_response]).sort(([a], [b]) => String(b).localeCompare(String(a)));
}
