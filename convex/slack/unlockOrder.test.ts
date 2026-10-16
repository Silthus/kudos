import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack, isWelcome } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsLoaded, flagsOnForEveryone, journeyShippedBeforeAnyoneJoined } from "../../testing/flags";
import { blockActions, publishedHome, readBlocks, type Block } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { appHomeOpened, emoji, memberEvent, mention, messageEvent, section } from "../../testing/slackMessages";
import { aSignedInSession, switchWebsite } from "../../testing/website";
import { api, internal } from "../_generated/api";
import { journeyOf } from "../quests/journey";
import type { MemberId } from "../workspace/directory";
import type { Feature } from "../unlocks/feature";

const now = new Date("2026-10-16T10:00:00Z");
const form = { contentType: "application/x-www-form-urlencoded" };
const everyFlag = ["xp-levels", "unlocks", "everyone-board", "quests", "achievements"];
const bookReady = "section: *Book* is ready. It opens achievements. [button: Open]";
const leaderboardReady = "section: *Leaderboard* is ready. It opens the boards. [button: Open]";
const questsReady = "section: *Quests* is ready. It opens your weekly quests. [button: Open]";

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB").withMember("U_CAROL");
  postHog = flagsOnForEveryone(slack.fetch, ...everyFlag);
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("unlock schedule 2: the Book at level 1, the Leaderboard at level 2, Quests at level 3", () => {
  test("a member at level 1 finds the Book ready in App Home with `Next: Leaderboard at level 2.`, and no DM names it", async () => {
    const t = await workspace();

    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");

    expect(unlockLinesOf(publishedHome(slack, "U_ALICE"))).toEqual([bookReady, "section: Next: Leaderboard at level 2."]);
    expect(dmsTo("U_ALICE")).toEqual([]);
  });

  test("level 2 makes the Leaderboard ready and level 3 Quests, each named in its level-up DM, and the Book in neither", async () => {
    const t = await workspace();

    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    await giveKudos(t, "U_ALICE", "U_BOB", 8);

    expect(dmsTo("U_ALICE").map(readDm)).toEqual([
      ["section: 🎉 You reached level 2!", "section: Level 3 is 80 XP away.", leaderboardReady],
      ["section: 🎉 You reached level 3!", "section: Level 4 is 200 XP away.", questsReady],
    ]);
    expect(await unlocksOf(t, "U_ALICE")).toEqual([
      { feature: "book", state: "ready" },
      { feature: "leaderboard", state: "ready" },
      { feature: "quests", state: "ready" },
    ]);
  });

  test("the ship sweep makes nothing ready for a member who has earned no XP, and sends them nothing; their first App Home shows the Book ready", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_CAROL", kind: "member", asOf: 0 }));

    await sweep(t);

    expect(await unlocksOf(t, "U_CAROL")).toEqual([]);
    expect(dmsTo("U_CAROL")).toEqual([]);

    await openHome(t, "U_CAROL");

    expect(unlockLinesOf(publishedHome(slack, "U_CAROL"))).toEqual([bookReady, "section: Next: Leaderboard at level 2."]);
    expect(dmsTo("U_CAROL")).toEqual([]);
  });

  test("a level-up DM and a ship sweep DM queued under schedule 1 that name the Book go out without it, and a DM left with nothing to name is not sent", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 1);
    await openHome(t, "U_ALICE");
    const member = await memberOf(t, "U_ALICE");
    const queued = { member, workspace: "T1", user: "U_ALICE" };

    await t.run((ctx) => ctx.scheduler.runAfter(0, internal.slack.directMessages.deliverDirectMessage, { ...queued, notification: { kind: "level-reached", level: 4, skillPoints: null, xpToNextLevel: 300, ready: ["book"] } }));
    await t.run((ctx) => ctx.scheduler.runAfter(0, internal.slack.directMessages.deliverDirectMessage, { ...queued, notification: { kind: "features-shipped", ready: ["book"] } }));
    await settle(t);

    expect(dmsTo("U_ALICE").map(readDm)).toEqual([["🎉 You reached level 4!", "Level 5 is 300 XP away."]]);
  });

  test("a member at level 1 whom nothing in Slack has shown unlocks signs in to the website first and reads the Book ready, and no DM names it", async () => {
    vi.stubEnv("SLACK_WORKSPACE_ID", "T1");
    const t = await journeyShippedBeforeAnyoneJoined(await workspace());
    await switchWebsite(t, postHog, true, ...everyFlag);
    await t.fetch("/slack/events", await signedRequest(memberEvent("team_join", { id: "U_CAROL", name: "carol" })));
    await settle(t);

    const { asSignedIn } = await aSignedInSession(t, { user: "U_CAROL", name: "Carol" });

    expect(await asSignedIn.query(api.website.book.getBook, {})).toEqual({ kind: "ready" });
    expect(dmsTo("U_CAROL")).toEqual([]);
  });

  test("a level 2 member who opened Quests under schedule 1 keeps them open; the sweep makes the Book and the Leaderboard ready and its DM names the Leaderboard alone", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    const openedAt = now.getTime() - 86_400_000;
    const alice = await asUnderScheduleOne(t, "U_ALICE", { quests: openedAt });
    const dmsBefore = dmsTo("U_ALICE").length;

    vi.setSystemTime(now.getTime() + 60_000);
    await sweep(t);

    expect(await unlockRowsOf(t, alice)).toEqual([
      { feature: "quests", readyAt: openedAt, openedAt },
      { feature: "book", readyAt: now.getTime() + 60_000 },
      { feature: "leaderboard", readyAt: now.getTime() + 60_000 },
    ]);
    expect(dmsTo("U_ALICE").slice(dmsBefore).map(readDm)).toEqual([[leaderboardReady]]);
  });

  test("the Journey lists its steps in the unlock order: first thanks, the Book's two days, the Leaderboard's someone new, then Quests' first quest", async () => {
    const t = await journeyShippedBeforeAnyoneJoined(await workspace());
    await giveKudos(t, "U_ALICE", "U_BOB", 10);
    for (const feature of ["quests", "leaderboard", "book"] as const) await send(t, blockActions("U_ALICE", openButtonOf(feature)));

    const member = await memberOf(t, "U_ALICE");
    expect((await t.run((ctx) => journeyOf(ctx, member))).map(({ step }) => step)).toEqual(["first-thanks", "two-days", "someone-new", "first-quest"]);
  });
});

function unlockLinesOf(home: string[]) {
  return home.filter((line) => line.includes("is ready.") || line.includes("Next:"));
}

type PostedDm = { channel?: unknown; text?: unknown; blocks?: unknown };

function dmsTo(user: string): PostedDm[] {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => channel === user && !isWelcome({ text }));
}

function readDm(dm: PostedDm) {
  return dm.blocks === undefined ? String(dm.text).split("\n") : readBlocks(dm.blocks as Block[]);
}

async function unlocksOf(t: Backend, user: string) {
  const member = await memberOf(t, user);
  const unlocks = await t.query(internal.unlocks.unlocks.memberUnlocks, { member });
  return unlocks.filter(({ state }) => state !== "locked").map(({ feature, state }) => ({ feature, state }));
}

async function unlockRowsOf(t: Backend, member: MemberId) {
  return t.run(async (ctx) =>
    (
      await ctx.db
        .query("unlocks")
        .withIndex("by_member_feature", (q) => q.eq("member", member))
        .collect()
    )
      .sort((a, b) => a._creationTime - b._creationTime)
      .map(({ feature, readyAt, openedAt }) => ({ feature, readyAt, ...(openedAt !== undefined && { openedAt }) })),
  );
}

async function asUnderScheduleOne(t: Backend, user: string, opened: Partial<Record<Feature, number>>) {
  const member = await memberOf(t, user);
  await t.run(async (ctx) => {
    for (const row of await ctx.db
      .query("unlocks")
      .withIndex("by_member_feature", (q) => q.eq("member", member))
      .collect())
      await ctx.db.delete(row._id);
    for (const [feature, at] of Object.entries(opened)) await ctx.db.insert("unlocks", { member, feature: feature as Feature, readyAt: at, openedAt: at });
  });
  return member;
}

async function memberOf(t: Backend, user: string): Promise<MemberId> {
  return t.run(async (ctx) => {
    const row = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    return row!._id;
  });
}

function openButtonOf(feature: Feature) {
  const command = JSON.stringify({ type: "openUnlock", feature });
  return { type: "button", action_id: command, value: command } as const;
}

async function workspace() {
  const t = await flagsLoaded(testBackend());
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return bookShippedBeforeAnyoneJoined(t);
}

async function sweep(t: Backend) {
  await t.mutation(internal.unlocks.sweep.sweep, {});
  await settle(t);
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

async function send(t: Backend, interaction: string) {
  const response = await t.fetch("/slack/interactivity", await signedRequest(interaction, form));
  await settle(t);
  return response;
}
