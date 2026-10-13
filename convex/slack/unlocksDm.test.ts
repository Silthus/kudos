import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack, rateLimitedFor } from "../../testing/fakeSlack";
import { flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { blockActions, buttonIn, publishedHome, readBlocks, type Block } from "../../testing/slackInteractions";
import { signedRequest, signingSecret } from "../../testing/signedSlack";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { emoji, mention, messageEvent, section } from "../../testing/slackMessages";
import { internal } from "../_generated/api";
import type { LevelReachedEvent } from "../bus/events";
import type { MemberId } from "../workspace/directory";

const now = new Date("2026-10-13T10:00:00Z");
const firstMessageAt = now.getTime() + 1000;
const form = { contentType: "application/x-www-form-urlencoded" };
const leaderboardReady = "section: *Leaderboard* is ready. It opens the boards. [button: Open]";
const openLeaderboardCommand = JSON.stringify({ type: "openUnlock", feature: "leaderboard" });
const openLeaderboard = { type: "button", action_id: openLeaderboardCommand, value: openLeaderboardCommand } as const;
const levelThreeDm = ["section: 🎉 You reached level 3!", "section: Level 4 is 200 XP away.", leaderboardReady];

type LevelReachedSubscriber = typeof internal.feedback.publicReplies.celebrateLevel | typeof internal.unlocks.unlocks.makeReady;

let slack: FakeSlack;
let postHog: FakePostHog;
let sentMessages = 0;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.stubEnv("SLACK_SIGNING_SECRET", signingSecret);
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  vi.stubEnv("SLACK_APP_ID", "A_KUDOS");
  slack = new FakeSlack().withMember("U_ALICE").withMember("U_BOB");
  postHog = flagsOnForEveryone(slack.fetch, "xp-levels", "unlocks", "everyone-board");
  sentMessages = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P74 P73: the level-up DM names what the level made ready, each with Open", () => {
  test("reaching level 3 sends one DM that names the Leaderboard with Open, and its text says the same", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    await giveKudos(t, "U_ALICE", "U_BOB", 8);

    expect(dmsTo("U_ALICE").map(readDm)).toEqual([["🎉 You reached level 2!", "Level 3 is 80 XP away."], levelThreeDm]);
    expect(dmsTo("U_ALICE")[1]?.text).toBe("🎉 You reached level 3!\nLevel 4 is 200 XP away.\n*Leaderboard* is ready. It opens the boards.");
  });

  test("clicking Open in the DM opens the Leaderboard for good and republishes App Home without its line; clicking it again changes nothing", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 10);
    const openButton = buttonIn(blocksOf(dmsTo("U_ALICE")[0]!), "Open");
    const inDm = { channel: "U_ALICE", ts: "1760349700.000100" };

    const response = await send(t, blockActions("U_ALICE", openButton, { inMessage: inDm }));

    expect(response.status).toBe(200);
    const opened = await unlockRows(t);
    expect(opened).toEqual([{ feature: "leaderboard", readyAt: firstMessageAt, openedAt: expect.any(Number) }]);
    expect(publishedHome(slack, "U_ALICE").filter((line) => line.includes("is ready."))).toEqual([]);

    vi.setSystemTime(now.getTime() + 60_000);
    await send(t, blockActions("U_ALICE", openButton, { inMessage: inDm }));

    expect(await unlockRows(t)).toEqual(opened);
    expect(dmsTo("U_ALICE")).toHaveLength(1);
  });

  test("a level up that makes no shipped feature ready sends the level-up DM as before, without an Open button", async () => {
    const t = await workspace();

    await giveKudos(t, "U_ALICE", "U_BOB", 2);

    expect(dmsTo("U_ALICE")).toEqual([{ channel: "U_ALICE", text: "🎉 You reached level 2!\nLevel 3 is 80 XP away." }]);
  });

  test("with everyone-board off, reaching level 3 sends the level-up DM without naming any feature", async () => {
    const t = await workspace();
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("everyone-board"));

    await giveKudos(t, "U_ALICE", "U_BOB", 10);

    expect(dmsTo("U_ALICE")).toEqual([{ channel: "U_ALICE", text: "🎉 You reached level 3!\nLevel 4 is 200 XP away." }]);
  });
});

describe("R34: a level-up DM rechecks what it names before each try", () => {
  test("a level-up DM Slack held back leaves out the Leaderboard once everyone-board went off, and still tells the level", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    slack.holdingBack("chat.postMessage", "U_ALICE", async () => {
      await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("everyone-board"));
      slack.answering("chat.postMessage", rateLimitedFor(30));
    });

    await giveKudos(t, "U_ALICE", "U_BOB", 8);

    expect(dmsTo("U_ALICE").map(readDm).slice(1)).toEqual([levelThreeDm, ["🎉 You reached level 3!", "Level 4 is 200 XP away."]]);
  });

  test("a level-up DM Slack held back leaves out the Leaderboard once the member opened it from App Home, and still tells the level", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    slack.holdingBack("chat.postMessage", "U_ALICE", async () => {
      await click(t, blockActions("U_ALICE", openLeaderboard));
      slack.answering("chat.postMessage", rateLimitedFor(30));
    });

    await giveKudos(t, "U_ALICE", "U_BOB", 8);

    expect(await unlockRows(t)).toEqual([{ feature: "leaderboard", readyAt: expect.any(Number), openedAt: expect.any(Number) }]);
    expect(dmsTo("U_ALICE").map(readDm).slice(1)).toEqual([levelThreeDm, ["🎉 You reached level 3!", "Level 4 is 200 XP away."]]);
  });

  test("a ship sweep DM Slack held back is not sent once the member opened the feature it names from App Home", async () => {
    const t = await workspace();
    await boardTurned(t, "off");
    await giveKudos(t, "U_ALICE", "U_BOB", 10);
    await boardTurned(t, "on");
    slack.holdingBack("chat.postMessage", "U_ALICE", async () => {
      await click(t, blockActions("U_ALICE", openLeaderboard));
      slack.answering("chat.postMessage", rateLimitedFor(30));
    });

    await sweep(t);

    expect(await unlockRows(t)).toEqual([{ feature: "leaderboard", readyAt: expect.any(Number), openedAt: expect.any(Number) }]);
    expect(dmsTo("U_ALICE").map(readDm).slice(1)).toEqual([[leaderboardReady]]);
  });
});

describe("P6: several levels at once", () => {
  test("an award that crosses levels 2 and 3 sends one DM, for level 3, naming the Leaderboard", async () => {
    const t = await workspace();

    await giveKudos(t, "U_ALICE", "U_BOB", 10);

    expect(dmsTo("U_ALICE").map(readDm)).toEqual([levelThreeDm]);
  });
});

describe("P74: one owner for readiness and the level-up DM", () => {
  test.each<[string, LevelReachedSubscriber[]]>([
    ["readiness first", [internal.unlocks.unlocks.makeReady, internal.feedback.publicReplies.celebrateLevel]],
    ["readiness last", [internal.feedback.publicReplies.celebrateLevel, internal.unlocks.unlocks.makeReady]],
  ])("the DM names exactly what was made ready, with %s", async (_, subscribers) => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    const reached = await levelThreeReachedBy(t, "U_ALICE");

    for (const subscriber of subscribers) {
      await t.mutation(subscriber, { event: reached });
      await settle(t);
    }

    expect(dmsTo("U_ALICE").map(readDm).slice(1)).toEqual([levelThreeDm]);
    expect(await unlockRows(t)).toEqual([{ feature: "leaderboard", readyAt: reached.at }]);
  });

  test("a replayed levelReached sends no second DM and makes nothing ready again", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    const reached = await levelThreeReachedBy(t, "U_ALICE");
    await t.mutation(internal.unlocks.unlocks.makeReady, { event: reached });
    await settle(t);

    await t.mutation(internal.unlocks.unlocks.makeReady, { event: { ...reached, at: reached.at + 1000 } });
    await settle(t);

    expect(dmsTo("U_ALICE").map(readDm).slice(1)).toEqual([levelThreeDm]);
    expect(await unlockRows(t)).toEqual([{ feature: "leaderboard", readyAt: reached.at }]);
  });

  test("a levelReached replayed after everyone-board went on makes nothing ready and sends nothing, leaving that readiness to the ship sweep", async () => {
    const t = await workspace();
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("everyone-board"));
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    const reached = await levelThreeReachedBy(t, "U_ALICE");
    await t.mutation(internal.unlocks.unlocks.makeReady, { event: reached });
    await settle(t);
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("everyone-board"));

    await t.mutation(internal.unlocks.unlocks.makeReady, { event: reached });
    await settle(t);

    expect(dmsTo("U_ALICE").map(readDm).slice(1)).toEqual([["🎉 You reached level 3!", "Level 4 is 200 XP away."]]);
    expect(await unlockRows(t)).toEqual([]);
  });

  test("a feature something else made ready first is not named again by the level-up DM, and App Home still lists it", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    const member = await memberOf(t, "U_ALICE");
    const readyEarlier = now.getTime() + 500;
    await t.run((ctx) => ctx.db.insert("unlocks", { member, feature: "leaderboard", readyAt: readyEarlier }));

    await giveKudos(t, "U_ALICE", "U_BOB", 8);

    expect(dmsTo("U_ALICE").map(readDm)[1]).toEqual(["🎉 You reached level 3!", "Level 4 is 200 XP away."]);
    expect(await unlockRows(t)).toEqual([{ feature: "leaderboard", readyAt: readyEarlier }]);
    await publishHome(t, "U_ALICE");
    expect(publishedHome(slack, "U_ALICE")).toContain(leaderboardReady);
  });
});

describe("P63 P74: with DMs off", () => {
  test("a member who turned DMs off gets no DM at level 3, and App Home still lists the Leaderboard ready", async () => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    const member = await memberOf(t, "U_ALICE");
    await t.run((ctx) => ctx.db.insert("progressSettings", { member, dms: false }));

    await giveKudos(t, "U_ALICE", "U_BOB", 8);

    expect(dmsTo("U_ALICE")).toHaveLength(1);
    expect(publishedHome(slack, "U_ALICE")).toContain(leaderboardReady);
  });
});

describe("P78: a feature that ships later becomes ready for members past its level", () => {
  test("a level 4 member who reached level 3 while everyone-board was off gets one DM naming the Leaderboard with Open at the next sweep, and App Home lists it", async () => {
    const t = await workspace();
    await boardTurned(t, "off");
    await giveKudos(t, "U_ALICE", "U_BOB", 10);
    await xpOf(t, "U_ALICE", 300);
    await boardTurned(t, "on");
    const sweptAt = Date.now();

    await sweep(t);

    expect(dmsTo("U_ALICE").map(readDm)).toEqual([["🎉 You reached level 3!", "Level 4 is 200 XP away."], [leaderboardReady]]);
    expect(dmsTo("U_ALICE")[1]?.text).toBe("*Leaderboard* is ready. It opens the boards.");
    expect(await unlockRows(t)).toEqual([{ feature: "leaderboard", readyAt: sweptAt }]);
    expect(publishedHome(slack, "U_ALICE")).toContain(leaderboardReady);
  });

  test("a second sweep, and everyone-board going off and on again, send nothing more and leave the Leaderboard ready with its first readyAt", async () => {
    const t = await workspace();
    await boardTurned(t, "off");
    await giveKudos(t, "U_ALICE", "U_BOB", 10);
    await boardTurned(t, "on");
    await sweep(t);
    const ready = await unlockRows(t);

    vi.setSystemTime(now.getTime() + 60 * 60 * 1000);
    await sweep(t);
    await boardTurned(t, "off");
    await sweep(t);
    await boardTurned(t, "on");
    await sweep(t);

    expect(dmsTo("U_ALICE")).toHaveLength(2);
    expect(await unlockRows(t)).toEqual(ready);
  });

  test("a member below the Leaderboard's level gets nothing from the sweep, and App Home names it in their Next line", async () => {
    const t = await workspace();
    await boardTurned(t, "off");
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    await boardTurned(t, "on");

    await sweep(t);

    expect(dmsTo("U_ALICE")).toHaveLength(1);
    expect(await unlockRows(t)).toEqual([]);
    await publishHome(t, "U_ALICE");
    expect(publishedHome(slack, "U_ALICE")).toContain("section: Next: Leaderboard at level 3.");
  });

  test("a member who turned DMs off gets no DM from the sweep, and App Home lists the Leaderboard ready", async () => {
    const t = await workspace();
    await boardTurned(t, "off");
    await giveKudos(t, "U_ALICE", "U_BOB", 10);
    const member = await memberOf(t, "U_ALICE");
    await t.run((ctx) => ctx.db.insert("progressSettings", { member, dms: false }));
    await boardTurned(t, "on");

    await sweep(t);

    expect(dmsTo("U_ALICE")).toHaveLength(1);
    expect(publishedHome(slack, "U_ALICE")).toContain(leaderboardReady);
  });

  test.each([
    ["the sweep first", ["sweep", "level up"]],
    ["the level up first", ["level up", "sweep"]],
  ] as const)("a level up and the sweep racing for the Leaderboard, with %s, name it in exactly one DM", async (_, order) => {
    const t = await workspace();
    await giveKudos(t, "U_ALICE", "U_BOB", 2);
    const reached = await levelThreeReachedBy(t, "U_ALICE");

    for (const step of order) {
      if (step === "sweep") await sweep(t);
      else await t.mutation(internal.unlocks.unlocks.makeReady, { event: reached });
      await settle(t);
    }

    const dms = dmsTo("U_ALICE").map(readDm);
    expect(dms.filter((lines) => lines.includes(leaderboardReady))).toHaveLength(1);
    expect(dms.filter((lines) => lines.includes("section: 🎉 You reached level 3!") || lines.includes("🎉 You reached level 3!"))).toHaveLength(1);
    expect(await unlockRows(t)).toEqual([{ feature: "leaderboard", readyAt: expect.any(Number) }]);
  });
});

type PostedDm = Record<string, unknown>;

function boardTurned(t: Backend, value: "on" | "off") {
  return flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), (value === "on" ? onForEveryone : offForEveryone)("everyone-board"));
}

async function sweep(t: Backend) {
  await t.mutation(internal.unlocks.sweep.sweep, {});
  await settle(t);
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

function dmsTo(user: string): PostedDm[] {
  return slack.callsTo("chat.postMessage").filter(({ channel, text }) => channel === user && !String(text).startsWith("👋 Welcome"));
}

function blocksOf(dm: PostedDm) {
  expect(dm.blocks, "the DM's blocks").toBeDefined();
  return dm.blocks as Block[];
}

function readDm(dm: PostedDm) {
  return dm.blocks === undefined ? String(dm.text).split("\n") : readBlocks(blocksOf(dm));
}

async function unlockRows(t: Backend) {
  return t.run(async (ctx) => (await ctx.db.query("unlocks").collect()).map(({ feature, readyAt, openedAt }) => ({ feature, readyAt, ...(openedAt !== undefined && { openedAt }) })));
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

async function levelThreeReachedBy(t: Backend, user: string): Promise<LevelReachedEvent> {
  const member = await memberOf(t, user);
  await t.run(async (ctx) => {
    const progress = await ctx.db
      .query("memberProgress")
      .withIndex("by_member", (q) => q.eq("member", member))
      .unique();
    await ctx.db.patch(progress!._id, { xp: 100 });
  });
  const message = { workspace: "T1", conversation: "C1", message: "1760349600.000100" };
  return { type: "levelReached", workspace: "T1", member, level: 3, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 200, message, at: Date.now() };
}

async function publishHome(t: Backend, user: string) {
  await t.run((ctx) => ctx.scheduler.runAfter(0, internal.slack.appHome.publishHome, { workspace: "T1", user }));
  await settle(t);
}

async function workspace() {
  const t = await flagsLoaded(testBackend());
  await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", kudosEmoji: "taco", baseAllowance: 10 }));
  return unlocksShippedBeforeAnyoneJoined(t);
}

async function giveKudos(t: Backend, giver: string, recipient: string, kudos: number) {
  sentMessages += 1;
  const blocks = [section(mention(recipient), ...Array.from({ length: kudos }, () => emoji("taco")))];
  await t.fetch("/slack/events", await signedRequest(messageEvent(blocks, { user: giver, ts: `${now.getTime() / 1000 + sentMessages}.000100` })));
  await settle(t);
}

async function send(t: Backend, interaction: string) {
  const response = await click(t, interaction);
  await settle(t);
  return response;
}

async function click(t: Backend, interaction: string) {
  return t.fetch("/slack/interactivity", await signedRequest(interaction, form));
}
