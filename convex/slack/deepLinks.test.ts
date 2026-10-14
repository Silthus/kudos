import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { routedFetch, type FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack, rateLimitedFor } from "../../testing/fakeSlack";
import { flagsFromPostHog, offForEveryone, onForEveryone, postHogDeciding, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { blockActions, readBlocks, type Block } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, messageChangedEvent, messageEvent, section, text } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import { notifyJourneyJoined, notifyQuestFinished, notifyWeeklyQuestFinished } from "../feedback/notify";
import { replyPrivately, type Given } from "../feedback/replies";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-13T10:00:00Z");
const siteUrl = "https://kudos-site.test";
const ref = { workspace: "T1", conversation: "C1", message: "1760349600.000100" };
const givenToBob: Given = { recipients: ["U_BOB"], perRecipient: 1, left: 9, skipped: [], awards: [{ kudos: 1 }] };
const leaderboardReady = "section: *Leaderboard* is ready. It opens the boards. [button: Open]";
const openLeaderboardCommand = JSON.stringify({ type: "openUnlock", feature: "leaderboard" });
const openLeaderboard = { type: "button", action_id: openLeaderboardCommand, value: openLeaderboardCommand } as const;
const form = { contentType: "application/x-www-form-urlencoded" };
const weeklyQuest = { kind: "weekly", week: "2026-10-12", slot: 0 } as const;

const closed: Array<{ condition: string; flags: string[]; env?: Record<string, string> }> = [
  { condition: "while the website flag is off", flags: [] },
  { condition: "while SITE_URL is unset", flags: ["website"], env: { SITE_URL: "" } },
  { condition: "while the website is open for another workspace only", flags: ["website"], env: { SLACK_WORKSPACE_ID: "T_OTHER" } },
];

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
  vi.stubEnv("SITE_URL", siteUrl);
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("SW13 SW14 SW18: the success reply ends its extras line with a link to the giver's progress while the website is open when Slack takes it", () => {
  test("the link is the last part of the extras line, after the gains", async () => {
    const t = await workspaceDeciding("xp-levels", "website");

    await giveKudos(t, "U_ALICE", ["U_BOB", "U_CAROL"]);

    expect(successRepliesTo("U_ALICE")).toEqual([
      ["<@U_BOB> and <@U_CAROL> got 1 kudos from you. You have 8 kudos left today.", `+20 XP · <${siteUrl}/|See your progress on the web>`],
    ]);
  });

  test("a reply with no other extras gets an extras line holding only the link", async () => {
    const t = await workspaceDeciding("website");

    await giveKudos(t, "U_ALICE", ["U_BOB"]);

    expect(successRepliesTo("U_ALICE")).toEqual([["<@U_BOB> got 1 kudos from you. You have 9 kudos left today.", `<${siteUrl}/|See your progress on the web>`]]);
  });

  test.each(closed)("$condition, the ephemeral is byte-for-byte today's", async ({ flags, env = {} }) => {
    stubbed(env);
    const t = await workspaceDeciding(...flags);

    await giveKudos(t, "U_ALICE", ["U_BOB"]);

    expect(slack.callsTo("chat.postEphemeral")).toEqual([{ channel: "C1", user: "U_ALICE", text: "<@U_BOB> got 1 kudos from you. You have 9 kudos left today." }]);
  });

  test("a reply held for Quests whose website turns off before its release goes out with no link", async () => {
    const t = await unlocksShippedBeforeAnyoneJoined(await workspaceDeciding("xp-levels", "unlocks", "quests", "website"));
    await memberInserted(t, "U_ALICE");
    await t.run((ctx) => replyPrivately(ctx, ref, undefined, "U_ALICE", { kind: "given", outcome: givenToBob, base: 10 }));

    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("quests"), offForEveryone("website"));
    vi.advanceTimersByTime(10_000);
    await settle(t);

    expect(successRepliesTo("U_ALICE")).toEqual([["<@U_BOB> got 1 kudos from you. You have 9 kudos left today.", "+10 XP"]]);
  });
});

describe("SW16: replies other than a success and public messages carry no link", () => {
  test("the over-allowance and invalid replies, the edited-message reply and the public reply name no website page", async () => {
    const t = await workspaceDeciding("xp-levels", "website", "everyone-board");
    await giveKudos(t, "U_ALICE", ["U_BOB"], 11);
    await giveKudos(t, "U_ALICE", ["U_ALICE"]);
    await giveKudos(t, "U_ALICE", ["U_BOB"], 2);
    await editLastKudos(t, "U_ALICE", ["U_CAROL"]);

    const replies = slack.ephemeralsTo("U_ALICE").map(({ text }) => String(text));
    expect(replies.filter((text) => !text.includes("got 2 kudos from you"))).toHaveLength(3);
    expect(replies.filter((text) => text.includes(siteUrl))).toEqual([expect.stringContaining("got 2 kudos from you")]);
    expect(channelPosts()).toEqual(["🎉 <@U_ALICE> reached level 2."]);
  });
});

describe("SW13 SW14 SW15: each DM ends with a link to its page on the web after its own checks, while the website is open", () => {
  test("the welcome DM's last line links to the website, after the App Home link", async () => {
    const t = await workspaceDeciding("website");

    await giveKudos(t, "U_ALICE", ["U_BOB"]);

    const welcome = welcomeLinesTo("U_ALICE");
    expect(welcome.at(-2)).toBe("<slack://app?team=T1&id=A_KUDOS&tab=home|Open App Home>");
    expect(welcome.at(-1)).toBe(`<${siteUrl}/|Open HedgeHug on the web>`);
  });

  test.each(closed)("$condition, the welcome DM ends with the App Home link, as today", async ({ flags, env = {} }) => {
    stubbed(env);
    const t = await workspaceDeciding(...flags);

    await giveKudos(t, "U_ALICE", ["U_BOB"]);

    expect(welcomeLinesTo("U_ALICE").at(-1)).toBe("<slack://app?team=T1&id=A_KUDOS&tab=home|Open App Home>");
  });

  test("the level-up DM's last line links to the member's level on the web", async () => {
    const t = await workspaceDeciding("xp-levels", "website");

    await giveKudos(t, "U_ALICE", ["U_BOB"], 2);

    expect(dmsTo("U_ALICE")).toEqual([{ channel: "U_ALICE", text: `🎉 You reached level 2!\nLevel 3 is 80 XP away.\n<${siteUrl}/|See your level on the web>` }]);
  });

  test.each(closed)("$condition, the level-up DM is today's", async ({ flags, env = {} }) => {
    stubbed(env);
    const t = await workspaceDeciding("xp-levels", ...flags);

    await giveKudos(t, "U_ALICE", ["U_BOB"], 2);

    expect(dmsTo("U_ALICE")).toEqual([{ channel: "U_ALICE", text: "🎉 You reached level 2!\nLevel 3 is 80 XP away." }]);
  });

  test("a level-up DM naming a ready feature puts the link after its Open button", async () => {
    const t = await unlocksLive("xp-levels", "unlocks", "everyone-board", "website");

    await giveKudos(t, "U_ALICE", ["U_BOB"], 10);

    expect(dmsTo("U_ALICE").map(readDm)).toEqual([
      ["section: 🎉 You reached level 3!", "section: Level 4 is 200 XP away.", leaderboardReady, `section: <${siteUrl}/|See your level on the web>`],
    ]);
    expect(dmsTo("U_ALICE")[0]?.text).toBe(`🎉 You reached level 3!\nLevel 4 is 200 XP away.\n*Leaderboard* is ready. It opens the boards.\n<${siteUrl}/|See your level on the web>`);
  });

  test("a ship sweep DM links to what's ready on the web, after its Open button", async () => {
    const t = await levelThreeWhileTheBoardWasOff();

    await sweep(t);

    expect(dmsTo("U_ALICE").map(readDm).slice(1)).toEqual([[leaderboardReady, `section: <${siteUrl}/|See what's ready on the web>`]]);
  });

  test("SW15: a ship sweep DM whose crates were all opened before delivery is not sent, link or not", async () => {
    const t = await levelThreeWhileTheBoardWasOff();
    slack.holdingBack("chat.postMessage", "U_ALICE", async () => {
      await t.fetch("/slack/interactivity", await signedRequest(blockActions("U_ALICE", openLeaderboard), form));
      slack.answering("chat.postMessage", rateLimitedFor(30));
    });

    await sweep(t);

    expect(dmsTo("U_ALICE").map(readDm).slice(1)).toEqual([[leaderboardReady, `section: <${siteUrl}/|See what's ready on the web>`]]);
    expect(dmsTo("U_ALICE")).toHaveLength(2);
  });

  test("a finished Journey step's DM links to the Journey on the web, after its Open button", async () => {
    const t = await questsLive();
    const alice = await memberInserted(t, "U_ALICE");

    await notified(t, (ctx) => notifyQuestFinished(ctx, alice, { kind: "journey", step: "first-thanks" }, 50));

    expect(lastLineOf(dmsTo("U_ALICE"))).toEqual([`section: <${siteUrl}/|See your Journey on the web>`]);
  });

  test("the Journey joined DM links to the Journey on the web once, as its last line", async () => {
    const t = await questsLive();
    const alice = await memberInserted(t, "U_ALICE");

    await notified(t, (ctx) => notifyJourneyJoined(ctx, alice, [{ quest: { kind: "journey", step: "first-thanks" }, xp: 50 }, { quest: { kind: "journey", step: "someone-new" }, xp: 50 }]));

    const [joined] = dmsTo("U_ALICE").map(readDm);
    expect(joined?.filter((line) => line.includes(siteUrl))).toEqual([`section: <${siteUrl}/|See your Journey on the web>`]);
    expect(joined?.at(-1)).toBe(`section: <${siteUrl}/|See your Journey on the web>`);
  });

  test("a finished weekly quest's DM links to the quests on the web", async () => {
    const t = await questsLive();
    const alice = await memberInserted(t, "U_ALICE");

    await notified(t, (ctx) => notifyWeeklyQuestFinished(ctx, alice, weeklyQuest, "Give kudos on two days.", 20));

    expect(lastLineOf(dmsTo("U_ALICE"))).toEqual([`section: <${siteUrl}/quests|See your quests on the web>`]);
  });

  test.each(closed)("$condition, a quest DM has no link", async ({ flags, env = {} }) => {
    stubbed(env);
    const t = await questsLive(flags);
    const alice = await memberInserted(t, "U_ALICE");

    await notified(t, (ctx) => notifyWeeklyQuestFinished(ctx, alice, weeklyQuest, "Give kudos on two days.", 20));

    expect(dmsTo("U_ALICE").map(readDm)).toEqual([["section: ✅ You finished a quest: Give kudos on two days. You earned *20 XP*. [button: Open]"]]);
  });
});

async function workspaceDeciding(...flags: string[]) {
  postHog = postHogDeciding("sandbox");
  vi.stubGlobal("fetch", routedFetch(postHog, slack.fetch));
  const t = testBackend();
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  await flagsFromPostHog(t, postHog, ...flags.map(onForEveryone));
  await t.mutation(internal.website.flag.prepareWebsiteFlag, {});
  return t;
}

async function unlocksLive(...flags: string[]) {
  return unlocksShippedBeforeAnyoneJoined(await workspaceDeciding(...flags));
}

async function questsLive(website = ["website"]) {
  return unlocksLive("xp-levels", "unlocks", "quests", ...website);
}

async function levelThreeWhileTheBoardWasOff() {
  const t = await unlocksLive("xp-levels", "unlocks", "website");
  await giveKudos(t, "U_ALICE", ["U_BOB"], 10);
  await flagsFromPostHog(t, postHog, ...["xp-levels", "unlocks", "website", "everyone-board"].map(onForEveryone));
  return t;
}

async function sweep(t: Backend) {
  await t.mutation(internal.unlocks.sweep.sweep, {});
  await settle(t);
}

async function notified(t: Backend, notify: Parameters<Backend["run"]>[0]) {
  await t.run(notify);
  await settle(t);
}

function stubbed(env: Record<string, string>) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
}

function memberInserted(t: Backend, user: string): Promise<MemberId> {
  return t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user, kind: "member" }));
}

async function giveKudos(t: Backend, giver: string, recipients: string[], kudos = 1) {
  sentMessages += 1;
  const blocks = [section(...recipients.map((recipient) => mention(recipient)), ...Array.from({ length: kudos }, () => emoji("taco")))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${now.getTime() / 1000 + sentMessages}.000100` })));
  await settle(t);
}

async function editLastKudos(t: Backend, giver: string, recipients: string[]) {
  const blocks = [section(text("thanks "), ...recipients.map((recipient) => mention(recipient)))];
  const ts = `${now.getTime() / 1000 + sentMessages}.000100`;
  const editedTs = `${now.getTime() / 1000 + sentMessages + 60}.000100`;
  await t.fetch("/slack/events", await signedRequest(messageChangedEvent(blocks, { user: giver, ts, editedTs })));
  await settle(t);
}

function successRepliesTo(user: string) {
  return slack.ephemeralsTo(user).map(({ text }) => String(text).split("\n"));
}

function channelPosts() {
  return slack
    .callsTo("chat.postMessage")
    .filter(({ channel }) => !String(channel).startsWith("U"))
    .map(({ text }) => String(text));
}

function welcomeLinesTo(user: string) {
  const welcome = slack.callsTo("chat.postMessage").find(({ channel, text }) => channel === user && String(text).startsWith("👋 Welcome"));
  return String(welcome?.text).split("\n");
}

function dmsTo(user: string) {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => channel === user && !String(text).startsWith("👋 Welcome"));
}

function readDm(dm: Record<string, unknown>) {
  return dm.blocks === undefined ? String(dm.text).split("\n") : readBlocks(dm.blocks as Block[]);
}

function lastLineOf(dms: Array<Record<string, unknown>>) {
  return dms.map(readDm).map((lines) => lines.at(-1));
}
