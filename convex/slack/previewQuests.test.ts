import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog, type FlagDefinition } from "../../testing/fakePostHog";
import { FakeSlack, rateLimitedFor, type SlackCall } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEmails, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, settleInTimeOrder, testBackend, type Backend } from "../../testing/slackBackend";
import { blockActions, buttonIn, publishedHome, publishedHomeBlocks, readBlocks, type Block } from "../../testing/slackInteractions";
import { appHomeOpened, emoji, mention, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import { questsLiveFor } from "../quests/flag";
import type { QuestId } from "../quests/pool";

const now = new Date("2026-10-13T10:00:00Z");
const thisWeek = "2026-10-12";
const saysWhy = "thanks for untangling the release notes today";
const form = { contentType: "application/x-www-form-urlencoded" };
const quests = "quests";
const alicesEmail = "alice@example.com";
const questTables = ["journeyLaunches", "journeySteps", "rewardRecords", "questDraws", "questSwaps", "questProgress", "crateOpenings", "previewMoments"] as const;

const xpAndUnlocksOn = [onForEveryone("xp-levels"), onForEveryone("unlocks")];
const previewedByAlice = [...xpAndUnlocksOn, onForEmails(quests, alicesEmail)];
const offForEveryoneElse = [...xpAndUnlocksOn, offForEveryone(quests)];
const onForTheWorkspace = [...xpAndUnlocksOn, onForEveryone(quests)];

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

describe("F17 F22: quests previewed by one member's email", () => {
  test("the previewer joins the Journey alone at their first kudos, and opening Quests draws their week", async () => {
    const t = await workspaceDeciding(...previewedByAlice);

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await openHome(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", buttonBeside(publishedHomeBlocks(slack, "U_ALICE"), "*Quests* is ready", "Open")));

    const rows = await questRows(t);
    expect(rows.previewMoments).toEqual([{ user: "U_ALICE", moment: "journey", at: expect.any(Number) }]);
    expect(rows.journeyLaunches).toEqual([]);
    expect(rows.rewardRecords).toEqual([{ user: "U_ALICE", key: "journey:first-thanks" }]);
    expect(rows.questDraws).toEqual([expect.objectContaining({ user: "U_ALICE", week: thisWeek })]);
    expect(rows.journeySteps.map((step) => [step.user, step.step]).sort()).toEqual([
      ["U_ALICE", "first-quest"],
      ["U_ALICE", "first-thanks"],
    ]);
    expect(publishedHome(slack, "U_ALICE")).toContain("section: *Journey:* ✅ Give a kudos that says why. You earned *10 XP*. [button: Open]");
  });

  test("the previewer finishes a weekly quest and the Journey step it completes, and opens its crate", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await openedQuests(t, "U_ALICE", ["say-why", "say-why-twice", "say-why-three-times"]);

    await giveKudos(t, "U_ALICE", "U_CAROL", saysWhy);
    await send(t, blockActions("U_ALICE", buttonIn(weeklyQuestDmsTo("U_ALICE")[0]!.blocks as Block[], "Open"), { inMessage: { channel: "U_ALICE", ts: "1760349800.000100" } }));

    const rows = await questRows(t);
    expect(rows.rewardRecords).toEqual([
      { user: "U_ALICE", key: "journey:first-quest" },
      { user: "U_ALICE", key: "journey:first-thanks" },
      { user: "U_ALICE", key: `weekly:${thisWeek}:0` },
    ]);
    expect(rows.crateOpenings).toEqual([{ user: "U_ALICE", key: `weekly:${thisWeek}:0` }]);
  });

  test("the other member draws, joins and earns nothing, and their Slack calls and App Home are exactly those with quests off", async () => {
    const whilePreviewed = await bobsSideOf(previewedByAlice);
    vi.clearAllTimers();
    const whileOff = await bobsSideOf(offForEveryoneElse);

    expect(whilePreviewed.rows).toEqual(Object.fromEntries(questTables.map((table) => [table, []])));
    expect(Object.values(whilePreviewed.conversations).flat().flatMap(readCall).filter(namesTheSlice)).toEqual([]);
    expect(whilePreviewed).toEqual(whileOff);
  });

  test("the preview moment joins the previewer in its own mutation: a Leaderboard opened before it activates someone-new at the moment, before any scheduled job runs", async () => {
    const t = await workspaceDeciding(...previewedByAlice, onForEveryone("everyone-board"));
    const alice = await t.run(async (ctx) => {
      const member = await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member", email: alicesEmail });
      await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member", email: "bob@example.com" });
      await ctx.db.insert("unlocks", { member, feature: "leaderboard", readyAt: now.getTime(), openedAt: now.getTime() });
      return member;
    });
    const previewedAt = now.getTime() + 60_000;
    vi.setSystemTime(previewedAt);

    await t.run((ctx) => questsLiveFor(ctx, alice));

    const { previewMoments, journeySteps } = await questRows(t);
    expect(previewMoments).toEqual([{ user: "U_ALICE", moment: "journey", at: previewedAt }]);
    expect(journeySteps.map(({ step, activatedAt }) => [step, activatedAt]).sort()).toEqual([
      ["first-thanks", previewedAt],
      ["someone-new", previewedAt],
    ]);
  });

  test("F25: exposures carry true for the previewing member and false for the other", async () => {
    const t = await workspaceDeciding(...previewedByAlice);

    await openHome(t, "U_ALICE");
    await openHome(t, "U_BOB");

    expect(await exposuresOf(t, "U_ALICE")).toEqual([[quests, true]]);
    expect(await exposuresOf(t, "U_BOB")).toEqual([[quests, false]]);
  });
});

describe("F18: a level a previewed quest reward reaches", () => {
  test("is not announced in the announcement channel while quests is off for the workspace, and the previewer still gets their level-up DM", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await announcingIn(t, "C_NEWS");

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await settle(t);

    expect((await questRows(t)).rewardRecords).toEqual([{ user: "U_ALICE", key: "journey:first-thanks" }]);
    expect(publicNotices()).toEqual([]);
    expect(dmsTo("U_ALICE").map(({ text }) => String(text))).toContainEqual(expect.stringContaining("You reached level 2!"));
  });

  test("queued while quests was on for the workspace, is not posted when Slack takes it after quests turned off there, though its member still previews", async () => {
    const t = await workspaceDeciding(...onForTheWorkspace);
    await announcingIn(t, "C_NEWS");
    slack.holdingBack("chat.postMessage", "C_NEWS", async () => {
      await flagsFromPostHog(t, postHog, ...previewedByAlice);
      slack.answering("chat.postMessage", rateLimitedFor(30));
    });

    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await settle(t);

    expect((await questRows(t)).rewardRecords).toEqual([{ user: "U_ALICE", key: "journey:first-thanks" }]);
    expect(slack.callsTo("chat.postMessage").filter(({ channel }) => channel === "C_NEWS")).toHaveLength(1);
    expect(slack.messagesIn("C_NEWS")).toEqual([]);
  });
});

describe("F21 F23: the Journey launch after a preview", () => {
  test("joins everyone who existed then, adds for the previewer only a step that became due since, and pays and sends nothing twice", async () => {
    const t = await workspaceDeciding(...previewedByAlice, onForEveryone("everyone-board"));
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await giveKudos(t, "U_BOB", "U_ALICE", saysWhy);
    await openHome(t, "U_ALICE");
    const previewed = await questRows(t);
    await flagsFromPostHog(t, postHog, ...offForEveryoneElse, onForEveryone("everyone-board"));
    await xpOf(t, "U_ALICE", 100);
    await sweep(t);
    await openHome(t, "U_ALICE");
    await send(t, blockActions("U_ALICE", buttonBeside(publishedHomeBlocks(slack, "U_ALICE"), "*Leaderboard* is ready", "Open")));
    const dmsBefore = questDmsTo("U_ALICE");
    vi.setSystemTime(Date.now() + 60_000);

    await flagsFromPostHog(t, postHog, ...onForTheWorkspace, onForEveryone("everyone-board"));
    await openHome(t, "U_BOB");
    await openHome(t, "U_ALICE");

    const rows = await questRows(t);
    expect(rows.journeyLaunches).toHaveLength(1);
    const launchedAt = rows.journeyLaunches[0]!.at as number;
    const stepsOf = (user: string) => rows.journeySteps.filter((step) => step.user === user).map(({ step, activatedAt }) => ({ step, activatedAt }));
    expect(stepsOf("U_ALICE")).toEqual([
      ...previewed.journeySteps.map(({ step, activatedAt }) => ({ step, activatedAt })),
      { step: "someone-new", activatedAt: launchedAt },
    ]);
    expect(stepsOf("U_BOB")).toEqual([{ step: "first-thanks", activatedAt: launchedAt }]);
    expect(rows.rewardRecords).toEqual([
      { user: "U_ALICE", key: "journey:first-thanks" },
      { user: "U_ALICE", key: "journey:someone-new" },
      { user: "U_BOB", key: "journey:first-thanks" },
    ]);
    expect(questDmsTo("U_ALICE")).toEqual([...dmsBefore, expect.objectContaining({ text: expect.stringContaining("someone you haven't thanked before") })]);
    expect(questDmsTo("U_ALICE").filter(({ text }) => String(text).includes("says why"))).toHaveLength(1);
  });
});

describe("F24: ending a quests preview", () => {
  test("hides quests, refuses a stale Swap, and keeps every reward, finish and crate, shown again unchanged when the preview comes back", async () => {
    const t = await workspaceDeciding(...previewedByAlice);
    await openedQuests(t, "U_ALICE", ["say-why", "say-why-twice", "say-why-three-times"]);
    await giveKudos(t, "U_ALICE", "U_CAROL", saysWhy);
    await send(t, blockActions("U_ALICE", buttonIn(weeklyQuestDmsTo("U_ALICE")[0]!.blocks as Block[], "Open"), { inMessage: { channel: "U_ALICE", ts: "1760349800.000100" } }));
    await openHome(t, "U_ALICE");
    const stored = await questRows(t);
    const shown = publishedHome(slack, "U_ALICE");
    const swap = buttonIn(publishedHomeBlocks(slack, "U_ALICE"), "Swap");

    await flagsFromPostHog(t, postHog, ...offForEveryoneElse);
    await send(t, blockActions("U_ALICE", swap));
    await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
    await openHome(t, "U_ALICE");
    await sweeps(t);
    const whileEnded = publishedHome(slack, "U_ALICE");
    const storedWhileEnded = await questRows(t);
    await flagsFromPostHog(t, postHog, ...previewedByAlice);
    await openHome(t, "U_ALICE");

    expect(shown.filter(namesTheSlice).length).toBeGreaterThan(0);
    expect(whileEnded.filter(namesTheSlice)).toEqual([]);
    expect(storedWhileEnded).toEqual(stored);
    expect(await questRows(t)).toEqual(stored);
    expect(publishedHome(slack, "U_ALICE").filter(namesTheSlice)).toEqual(shown.filter(namesTheSlice));
  });
});

async function bobsSideOf(definitions: FlagDefinition[]) {
  const t = await workspaceDeciding(...definitions);
  await giveKudos(t, "U_ALICE", "U_BOB", saysWhy);
  await giveKudos(t, "U_BOB", "U_ALICE", saysWhy);
  await openHome(t, "U_ALICE");
  await openHome(t, "U_BOB");
  vi.setSystemTime(now.getTime() + 3_600_000);
  await sweeps(t);
  await giveKudos(t, "U_BOB", "U_CAROL", saysWhy);
  await openHome(t, "U_BOB");
  const rows = await questRows(t, "U_BOB");
  return { conversations: callsByConversationInAnyOrder(slack.calls.filter((call) => !isAbout(call, "U_ALICE"))), homeShown: slack.homeShownTo("U_BOB"), rows };
}

async function workspaceDeciding(...definitions: FlagDefinition[]) {
  slack = new FakeSlack()
    .withMember("U_ALICE", { profile: { email: alicesEmail } })
    .withMember("U_BOB", { profile: { email: "bob@example.com" } })
    .withMember("U_CAROL", { profile: { email: "carol@example.com" } });
  sentMessages = 0;
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return unlocksShippedBeforeAnyoneJoined(await flagsFromPostHog(t, postHog, ...definitions));
}

async function announcingIn(t: Backend, channel: string) {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("workspaces")
      .withIndex("by_workspace", (q) => q.eq("workspace", "T1"))
      .unique();
    await ctx.db.patch(row!._id, { announcementChannel: channel });
  });
}

async function openedQuests(t: Backend, user: string, drawn: QuestId[]) {
  await giveKudos(t, user, "U_BOB", saysWhy);
  await openHome(t, user);
  await t.run(async (ctx) => {
    const member = (await ctx.db.query("members").collect()).find((row) => row.user === user)!._id;
    const slots = drawn.map((quest, slot) => ({ slot, quest, reward: { xp: 20, coins: 0, item: null }, catalogueVersion: "1", feasibleBecause: { peopleLeft: 2, recognitionsLeft: 18 } }));
    await ctx.db.insert("questDraws", { member, week: thisWeek, drawnAt: Date.now(), slots });
  });
  await send(t, blockActions(user, buttonBeside(publishedHomeBlocks(slack, user), "*Quests* is ready", "Open")));
}

async function giveKudos(t: Backend, giver: string, recipient: string, words: string) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), text(` ${words} `), emoji("taco"))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${Math.floor(Date.now() / 1000) + sentMessages}.000100` })));
  await settleInTimeOrder(t);
}

async function openHome(t: Backend, user: string) {
  await t.fetch("/slack/events", await signedRequest(appHomeOpened(user)));
  await settle(t);
}

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  await settle(t);
  return response;
}

async function sweep(t: Backend) {
  await t.mutation(internal.unlocks.sweep.sweep, {});
  await settle(t);
}

async function sweeps(t: Backend) {
  await t.mutation(internal.quests.newWeek.sweep, {});
  await t.mutation(internal.unlocks.sweep.sweep, {});
  await settle(t);
}

function buttonBeside(blocks: Block[], beside: string, label: string) {
  return buttonIn(
    blocks.filter((block) => readBlocks([block])[0]!.includes(beside)),
    label,
  );
}

function namesTheSlice(line: string) {
  return /Quest|quest|Journey|Swap/.test(line);
}

function callsByConversationInAnyOrder(calls: SlackCall[]) {
  const byConversation = new Map<string, SlackCall[]>();
  for (const call of calls) {
    const { args } = call;
    const conversation = `${call.method} ${String(args.channel ?? args.user_id ?? args.user ?? args.users ?? "")}`;
    byConversation.set(conversation, [...(byConversation.get(conversation) ?? []), call]);
  }
  for (const inConversation of byConversation.values()) inConversation.sort((one, other) => JSON.stringify(one).localeCompare(JSON.stringify(other)));
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

async function questRows(t: Backend, onlyUser?: string) {
  return t.run(async (ctx) => {
    const userOf = async (member: unknown) => (member === undefined ? null : ((await ctx.db.get(member as never)) as { user: string } | null)?.user);
    const rows = {} as Record<(typeof questTables)[number], Array<Record<string, unknown>>>;
    for (const table of questTables) {
      const stored = await ctx.db.query(table).collect();
      const read = await Promise.all(
        stored.map(async (row) => {
          const { _id, _creationTime, member, ...rest } = row as Record<string, unknown>;
          return table === "rewardRecords" || table === "crateOpenings" ? { user: await userOf(member), key: rest.key } : { user: await userOf(member), ...rest };
        }),
      );
      rows[table] = read
        .filter((row) => onlyUser === undefined || row.user === onlyUser)
        .sort((one, other) => JSON.stringify(one).localeCompare(JSON.stringify(other)));
    }
    return rows;
  });
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

function publicNotices() {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ channel, text }) => !String(channel).startsWith("U") && String(text).includes("reached level"))
    .map(({ channel, text }) => ({ channel, text }));
}

type PostedDm = Record<string, unknown>;

function sentDms(): PostedDm[] {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => String(channel).startsWith("U_") && !String(text).startsWith("👋 Welcome"));
}

function dmsTo(user: string): PostedDm[] {
  return sentDms().filter(({ channel }) => channel === user);
}

function questDmsTo(user: string) {
  return dmsTo(user).filter(({ text }) => String(text).startsWith("✅ You finished"));
}

function weeklyQuestDmsTo(user: string) {
  return questDmsTo(user).filter(({ text }) => String(text).startsWith("✅ You finished a quest"));
}

async function exposuresOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const analyticsId = await t.run(async (ctx) => (await ctx.db.query("analyticsIds").withIndex("by_member", (q) => q.eq("member", member)).unique())?.analyticsId);
  const sent = postHog.events().filter(({ event, distinct_id, properties }) => event === "$feature_flag_called" && distinct_id === analyticsId && properties.$feature_flag === quests);
  const once = [...new Map(sent.map((event) => [event.uuid, event])).values()];
  return once.map(({ properties }) => [properties.$feature_flag, properties.$feature_flag_response]);
}
