import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, type SlackCall } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { publishedHome, readBlocks, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, slashCommandResponseUrl } from "../../testing/slackMessages";
import { internal } from "../_generated/api";

const now = new Date("2026-10-13T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };
const unlocks = "unlocks";
const alicesEmail = "alice@example.com";
const leaderboardReady = "section: *Leaderboard* is ready. It opens the boards. [button: Open]";
const skillTreeReady = "section: *Skill tree* is ready. It opens the tree and your first skill point. [button: Open]";

const xpAndBoardOn = [onForEveryone("xp-levels"), onForEveryone("everyone-board")];
const previewedByAlice = [...xpAndBoardOn, onForEmails(unlocks, alicesEmail)];
const offForEveryoneElse = [...xpAndBoardOn, offForEveryone(unlocks)];
const onForTheWorkspace = [...xpAndBoardOn, onForEveryone(unlocks)];

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

describe("F22: unlocks previewed by one member's email", () => {
  test("the first mutation that shows the previewing member unlocks opens the Leaderboard at that moment, whatever their level, once, and DMs nothing about it", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    const firstShown = now.getTime() + 60_000;
    vi.setSystemTime(firstShown);

    await openHome(t, "U_ALICE");
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");

    const moments = await previewMomentsOf(t);
    expect(moments).toEqual([{ user: "U_ALICE", moment: "unlocks", at: expect.any(Number) }]);
    const moment = moments[0]!.at;
    expect(moment).toBeGreaterThanOrEqual(firstShown);
    expect(await unlockRowsOf(t, "U_ALICE")).toEqual([{ feature: "leaderboard", readyAt: moment, openedAt: moment }]);
    expect(await launches(t)).toEqual([]);
    expect(sentDms()).toEqual([]);
    expect(publishedHome(slack, "U_ALICE")[0]).toBe("actions: [Profile] | Leaderboard | Settings");
  });

  test("the preview moment's openings reach analytics as opened by the launch, as the workspace launch's do", async () => {
    const t = await workspaceDeciding(...previewedByAlice);

    await openHome(t, "U_ALICE");

    const opened = productEventsNamed("unlock opened");
    expect(opened.map(({ properties }) => properties)).toEqual([expect.objectContaining({ feature: "leaderboard", by: "launch" })]);
    expect(opened.map(({ distinct_id }) => distinct_id)).toEqual(productEventsNamed("app home opened").map(({ distinct_id }) => distinct_id));
  });

  test("the other member's Slack calls, command reply and unlock rows are exactly those with unlocks off: no crate, no Next: line, no ship-sweep DM", async () => {
    const whilePreviewed = await bobsSideOf(previewedByAlice);
    vi.clearAllTimers();
    const whileOff = await bobsSideOf(offForEveryoneElse);

    expect(Object.values(whilePreviewed.conversations).flat().flatMap(readCall).filter(namesAnUnlock)).toEqual([]);
    expect(whilePreviewed).toEqual(whileOff);
  });

  test("a feature that ships during the preview follows the schedule for the previewing member alone", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");
    await xpOf(t, "U_ALICE", 600);
    await xpOf(t, "U_BOB", 600);

    await flagsFromPostHog(t, postHog, ...previewedByAlice, onForEveryone("skill-tree"));
    await sweep(t);

    expect(dmsTo("U_ALICE").map(readDm).at(-1)).toEqual([skillTreeReady]);
    expect(dmsTo("U_BOB").filter((dm) => readDm(dm).some(namesAnUnlock))).toEqual([]);
  });

  test("a ship sweep that is the first to show a member their preview opens what shipped for them and publishes their App Home with it", async () => {
    const t = await workspaceDeciding(onForEveryone("xp-levels"), offForEveryone("everyone-board"), offForEveryone(unlocks));
    await giveKudos(t, "U_ALICE", "U_BOB", 10);
    const publishedBefore = slack.callsTo("views.publish").length;

    await flagsFromPostHog(t, postHog, ...previewedByAlice);
    await sweep(t);

    expect(slack.callsTo("views.publish").slice(publishedBefore).filter(({ user_id }) => user_id === "U_ALICE")).toHaveLength(1);
    expect(publishedHome(slack, "U_ALICE")[0]).toBe("actions: [Profile] | Leaderboard | Settings");
    expect(await unlockRowsOf(t, "U_ALICE")).toEqual([{ feature: "leaderboard", readyAt: expect.any(Number), openedAt: expect.any(Number) }]);
    expect(dmsTo("U_ALICE").filter((dm) => readDm(dm).some(namesAnUnlock))).toEqual([]);
  });

  test("F25: exposures carry true for the previewing member and false for the other", async () => {
    const t = await workspaceDeciding(...previewedByAlice);

    await openHome(t, "U_ALICE");
    await openHome(t, "U_BOB");

    expect(await exposuresOf(t, "U_ALICE")).toEqual([[unlocks, true]]);
    expect(await exposuresOf(t, "U_BOB")).toEqual([[unlocks, false]]);
  });

  test("F19: a /hedgehug leaderboard caller the directory doesn't know gets the workspace decision, and their exposure once known is their own", async () => {
    const t = await workspaceDeciding(...previewedByAlice);

    const reply = await leaderboardCommand(t, "U_ALICE");

    expect(reply).toEqual({ status: 200, body: { response_type: "ephemeral", text: "Give kudos this week to join the board." } });
    expect(await exposuresOf(t, "U_ALICE")).toEqual([[unlocks, true]]);
  });
});

describe("F23: the workspace launch after a preview adds only what is missing", () => {
  test("turning unlocks on for the workspace opens for everyone who existed then, keeps the previewer's first opening, adds a feature shipped since, and sends nothing twice", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");
    const previewedAt = (await previewMomentsOf(t))[0]!.at;
    await flagsFromPostHog(t, postHog, ...previewedByAlice, onForEveryone("skill-tree"));
    const dmsBefore = sentDms();
    vi.setSystemTime(previewedAt + 60_000);

    await flagsFromPostHog(t, postHog, ...onForTheWorkspace, onForEveryone("skill-tree"));
    await openHome(t, "U_BOB");
    await openHome(t, "U_ALICE");

    const launched = await launches(t);
    expect(launched).toEqual([{ at: expect.toSatisfy((at: number) => at > previewedAt), shipped: ["leaderboard", "skillTree"] }]);
    const launchedAt = launched[0]!.at;
    expect(await unlockRowsOf(t, "U_ALICE")).toEqual([
      { feature: "leaderboard", readyAt: previewedAt, openedAt: previewedAt },
      { feature: "skillTree", readyAt: launchedAt, openedAt: launchedAt },
    ]);
    expect(await unlockRowsOf(t, "U_BOB")).toEqual([
      { feature: "leaderboard", readyAt: launchedAt, openedAt: launchedAt },
      { feature: "skillTree", readyAt: launchedAt, openedAt: launchedAt },
    ]);
    expect(sentDms()).toEqual(dmsBefore);
  });
});

describe("F17: a feature shipped by one member's email", () => {
  const boardForAliceOnly = [onForEveryone("xp-levels"), onForEmails("everyone-board", alicesEmail), onForEveryone(unlocks)];

  test("is made ready by a level up for that member alone", async () => {
    const t = await unlocksShippedBeforeAnyoneJoined(await workspaceDeciding(...boardForAliceOnly));

    await giveKudos(t, "U_ALICE", "U_BOB", 10);
    await giveKudos(t, "U_BOB", "U_ALICE", 10);

    expect(dmsTo("U_ALICE").map(readDm).at(-1)).toContain(leaderboardReady);
    expect(dmsTo("U_BOB").map(readDm).at(-1)).not.toContain(leaderboardReady);
    expect(await unlockRowsOf(t, "U_ALICE")).toEqual([{ feature: "leaderboard", readyAt: expect.any(Number) }]);
    expect(await unlockRowsOf(t, "U_BOB")).toEqual([]);
  });

  test("is made ready by the ship sweep for that member alone", async () => {
    const t = await unlocksShippedBeforeAnyoneJoined(await workspaceDeciding(onForEveryone("xp-levels"), offForEveryone("everyone-board"), onForEveryone(unlocks)));
    await giveKudos(t, "U_ALICE", "U_BOB", 10);
    await giveKudos(t, "U_BOB", "U_ALICE", 10);
    const dmsBefore = sentDms();

    await flagsFromPostHog(t, postHog, ...boardForAliceOnly);
    await sweep(t);

    expect(sentDms().slice(dmsBefore.length).map((dm) => [dm.channel, readDm(dm)])).toEqual([["U_ALICE", [leaderboardReady]]]);
    expect(await unlockRowsOf(t, "U_BOB")).toEqual([]);
  });
});

describe("F24: ending an unlocks preview", () => {
  test("hides unlocks and keeps every ready and opened feature with its times, shown again unchanged when the preview comes back", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");
    await flagsFromPostHog(t, postHog, ...previewedByAlice, onForEveryone("skill-tree"));
    await xpOf(t, "U_ALICE", 590);
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");
    const stored = await unlockRowsOf(t, "U_ALICE");
    const shown = publishedHome(slack, "U_ALICE");

    await flagsFromPostHog(t, postHog, ...offForEveryoneElse, onForEveryone("skill-tree"));
    await openHome(t, "U_ALICE");
    const whileEnded = publishedHome(slack, "U_ALICE");
    await flagsFromPostHog(t, postHog, ...previewedByAlice, onForEveryone("skill-tree"));
    await openHome(t, "U_ALICE");

    expect(stored).toEqual([
      { feature: "leaderboard", readyAt: expect.any(Number), openedAt: expect.any(Number) },
      { feature: "skillTree", readyAt: expect.any(Number) },
    ]);
    expect(shown).toContain(skillTreeReady);
    expect(whileEnded.filter(namesAnUnlock)).toEqual([]);
    expect(await unlockRowsOf(t, "U_ALICE")).toEqual(stored);
    expect(publishedHome(slack, "U_ALICE")).toEqual(shown);
  });
});

async function bobsSideOf(definitions: FlagDefinition[]) {
  const t = await workspaceDeciding(...definitions);
  await giveKudos(t, "U_ALICE", "U_BOB", 2);
  await giveKudos(t, "U_BOB", "U_ALICE", 10);
  await openHome(t, "U_ALICE");
  await openHome(t, "U_BOB");
  await xpOf(t, "U_BOB", 600);
  await flagsFromPostHog(t, postHog, ...definitions, onForEveryone("skill-tree"));
  vi.setSystemTime(now.getTime() + 3_600_000);
  await sweep(t);
  await openHome(t, "U_BOB");
  const reply = await leaderboardCommand(t, "U_BOB");
  return { reply, conversations: conversationsOf(slack.calls.filter((call) => !isAbout(call, "U_ALICE"))), rows: await unlockRowsOf(t, "U_BOB") };
}

function conversationsOf(calls: SlackCall[]) {
  const byConversation = new Map<string, SlackCall[]>();
  for (const call of calls) {
    const { args } = call;
    const conversation = `${call.method} ${String(args.channel ?? args.user_id ?? args.user ?? args.users ?? "")}`;
    byConversation.set(conversation, [...(byConversation.get(conversation) ?? []), call]);
  }
  return Object.fromEntries([...byConversation].sort(([a], [b]) => a.localeCompare(b)));
}

function isAbout({ args }: SlackCall, user: string) {
  return [args.user_id, args.user, args.users, args.channel].includes(user);
}

function readCall({ args }: SlackCall): string[] {
  const view = args.view as { blocks?: Block[] } | undefined;
  const blocks = (args.blocks ?? view?.blocks) as Block[] | undefined;
  return blocks === undefined ? String(args.text ?? "").split("\n") : readBlocks(blocks);
}

function namesAnUnlock(line: string) {
  return /is ready|Next:|Open\]|opens at level/.test(line);
}

function productEventsNamed(name: string) {
  return postHog.productEvents().filter(({ event }) => event === name);
}

async function workspaceDeciding(...definitions: FlagDefinition[]) {
  slack = new FakeSlack().withMember("U_ALICE", { profile: { email: alicesEmail } }).withMember("U_BOB", { profile: { email: "bob@example.com" } });
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

async function sweep(t: Backend) {
  await t.mutation(internal.unlocks.sweep.sweep, {});
  await settle(t);
}

async function leaderboardCommand(t: Backend, user: string) {
  const body = new URLSearchParams({
    team_id: "T1",
    channel_id: "C1",
    channel_name: "general",
    user_id: user,
    command: "/hedgehug",
    text: "leaderboard",
    response_url: slashCommandResponseUrl,
    trigger_id: "1.2.3",
  }).toString();
  const response = await t.fetch("/slack/commands", await signedRequest(body, form));
  await settle(t);
  const reply = await response.text();
  return { status: response.status, body: reply === "" ? "" : JSON.parse(reply) };
}

type PostedDm = Record<string, unknown>;

function sentDms(): PostedDm[] {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => String(channel).startsWith("U_") && !String(text).startsWith("👋 Welcome"));
}

function dmsTo(user: string): PostedDm[] {
  return sentDms().filter(({ channel }) => channel === user);
}

function readDm(dm: PostedDm) {
  return dm.blocks === undefined ? String(dm.text).split("\n") : readBlocks(dm.blocks as Block[]);
}

async function memberOf(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return member!._id;
  });
}

async function unlockRowsOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  return t.run(async (ctx) => {
    const rows = await ctx.db
      .query("unlocks")
      .withIndex("by_member_feature", (q) => q.eq("member", member))
      .collect();
    return rows.map(({ feature, readyAt, openedAt }) => ({ feature, readyAt, ...(openedAt !== undefined && { openedAt }) })).sort((a, b) => a.feature.localeCompare(b.feature));
  });
}

async function previewMomentsOf(t: Backend) {
  return t.run(async (ctx) => {
    const rows = await ctx.db.query("previewMoments").collect();
    return Promise.all(rows.map(async ({ member, moment, at }) => ({ user: (await ctx.db.get(member))!.user, moment, at })));
  });
}

async function launches(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("unlockLaunches").collect()).map(({ at, shipped }) => ({ at, shipped })));
}

async function xpOf(t: Backend, user: string, xp: number) {
  const member = await memberOf(t, user);
  await t.run(async (ctx) => {
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(progress!._id, { xp });
  });
}

async function exposuresOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const analyticsId = await t.run(async (ctx) => (await ctx.db.query("analyticsIds").withIndex("by_member", (q) => q.eq("member", member)).unique())?.analyticsId);
  const sent = postHog.events().filter(({ event, distinct_id, properties }) => event === "$feature_flag_called" && distinct_id === analyticsId && properties.$feature_flag === unlocks);
  const once = [...new Map(sent.map((event) => [event.uuid, event])).values()];
  return once.map(({ properties }) => [properties.$feature_flag, properties.$feature_flag_response]);
}

