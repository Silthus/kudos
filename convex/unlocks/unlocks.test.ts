import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { withoutCollectionExposure, withoutDropExposures } from "../../testing/hoggies";
import { FakeSlack } from "../../testing/fakeSlack";
import type { FakePostHog } from "../../testing/fakePostHog";
import { flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { LevelReachedEvent } from "../bus/events";
import { publish } from "../bus/publish";
import schema from "../schema";
import type { MemberId } from "../workspace/directory";
import type { Feature } from "./feature";
import { openUnlock, stateOf } from "./unlocks";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-13T10:00:00Z");
const weekMs = 7 * 24 * 60 * 60 * 1000;

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  postHog = flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "everyone-board");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P73 P79: readiness is stored once, with its time, when levelReached arrives", () => {
  test("reaching level 3 with everyone-board on makes the Leaderboard ready at the event's time and publishes unlockReady", async () => {
    const { t, alice } = await withMember();

    await levelReached(t, alice, 3);

    expect(await unlocksOf(t, alice)).toEqual([{ feature: "leaderboard", state: "ready", readyAt: now.getTime(), openedAt: null }]);
    expect(published("unlockReady")).toEqual([{ type: "unlockReady", workspace: "T1", member: alice, feature: "leaderboard", at: now.getTime() }]);
  });

  test("P6: a member who jumps from level 1 to level 5 gets every shipped feature at or below level 5, and level 2 alone makes nothing ready", async () => {
    const { t, alice } = await withMember();
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("everyone-board"), onForEveryone("quests"));

    await levelReached(t, alice, 2);
    expect(await unlocksOf(t, alice)).toEqual([{ feature: "quests", state: "locked", readyAt: null, openedAt: null }]);

    await levelReached(t, alice, 5);
    expect(await unlocksOf(t, alice)).toEqual([{ feature: "quests", state: "ready", readyAt: now.getTime(), openedAt: null }]);
  });

  test("a replayed levelReached writes nothing new and publishes nothing new", async () => {
    const { t, alice } = await withMember();
    const event = levelReachedEvent(alice, 3);
    await t.mutation(internal.unlocks.unlocks.makeReady, { event });
    const before = await everyTable(t);
    vi.mocked(publish).mockClear();

    vi.setSystemTime(now.getTime() + 60_000);
    await t.mutation(internal.unlocks.unlocks.makeReady, { event });

    expect(await everyTable(t)).toEqual(before);
    expect(vi.mocked(publish)).not.toHaveBeenCalled();
  });
});

describe("P78: an unshipped feature is never ready, named or counted", () => {
  test("with everyone-board off, level 7 makes nothing ready, and the website read leaves every feature out", async () => {
    const { t, alice } = await withMember();
    await boardTurned(t, "off");

    await levelReached(t, alice, 7);

    expect(await unlocksOf(t, alice)).toEqual([]);
    expect(await state(t, alice, "leaderboard")).toBe("unshipped");
    expect(published("unlockReady")).toEqual([]);
  });

  test("the website read gives each shipped feature's state, readyAt and openedAt, and leaves unshipped features out", async () => {
    const { t, alice } = await withMember();
    expect(await unlocksOf(t, alice)).toEqual([{ feature: "leaderboard", state: "locked", readyAt: null, openedAt: null }]);

    await levelReached(t, alice, 2);
    expect(await unlocksOf(t, alice)).toEqual([{ feature: "leaderboard", state: "ready", readyAt: now.getTime(), openedAt: null }]);

    vi.setSystemTime(now.getTime() + 60_000);
    await open(t, alice, "leaderboard");
    expect(await unlocksOf(t, alice)).toEqual([{ feature: "leaderboard", state: "open", readyAt: now.getTime(), openedAt: now.getTime() + 60_000 }]);
    expect(await state(t, alice, "quests")).toBe("unshipped");
  });
});

describe("P73: openUnlock opens a ready feature and refuses every other", () => {
  test("opening a ready feature stores openedAt, publishes unlockOpened and is done", async () => {
    const { t, alice } = await withMember();
    await levelReached(t, alice, 3);
    vi.setSystemTime(now.getTime() + 60_000);

    expect(await open(t, alice, "leaderboard")).toBe("done");

    const openedAt = now.getTime() + 60_000;
    expect(await unlocksOf(t, alice)).toEqual([{ feature: "leaderboard", state: "open", readyAt: now.getTime(), openedAt }]);
    expect(published("unlockOpened")).toEqual([{ type: "unlockOpened", workspace: "T1", member: alice, feature: "leaderboard", at: openedAt }]);
  });

  test.each([
    ["locked", 1, "leaderboard", "on"],
    ["unshipped, with no flag", 7, "book", "on"],
    ["ready while everyone-board is off", 3, "leaderboard", "off"],
  ] as const)("a stale open for a feature that is %s writes nothing, publishes nothing and is refused", async (_, level, feature, board) => {
    const { t, alice } = await withMember();
    await levelReached(t, alice, level);
    if (board === "off") await boardTurned(t, "off");
    const before = await everyTable(t);
    vi.mocked(publish).mockClear();

    expect(await open(t, alice, feature)).toBe("refused");

    expect(await everyTable(t)).toEqual(before);
    expect(vi.mocked(publish)).not.toHaveBeenCalled();
  });
});

describe("P92: opening grants nothing", () => {
  test("opening writes only the feature's openedAt: every effects record, the XP, the level and the skill points spent are as they were", async () => {
    const { t, alice } = await withMember();
    await withEarnings(t, alice, 300);
    await levelReached(t, alice, 3);
    const before = await everyTable(t);

    await open(t, alice, "leaderboard");

    const after = await everyTable(t);
    expect(withoutCollectionExposure({ ...after, unlocks: [] })).toEqual({ ...before, unlocks: [] });
    expect(after.unlocks).toEqual(before.unlocks.map((row) => ({ ...row, openedAt: now.getTime() })));
    expect(published("unlockOpened")).toHaveLength(1);
  });

  test("with collection on, a member's own open also drops one hoggie before unlockOpened, and nothing else changes", async () => {
    postHog = flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "everyone-board", "collection");
    const { t, alice } = await withMember();
    await withEarnings(t, alice, 300);
    await levelReached(t, alice, 3);
    const before = await everyTable(t);
    vi.mocked(publish).mockClear();

    await open(t, alice, "leaderboard");

    const after = await everyTable(t);
    expect(withoutDropExposures({ ...after, unlocks: [], drops: [], hoggieTallies: [], dropTallies: [] })).toEqual({ ...before, unlocks: [] });
    expect(after.drops).toEqual([expect.objectContaining({ member: alice, crate: "unlock:leaderboard", n: 1, copy: 1, at: now.getTime() })]);
    expect(vi.mocked(publish).mock.calls.map(([, event]) => event.type)).toEqual(["hoggieDropped", "unlockOpened"]);
  });
});

describe("P5: a ready or opened feature is kept for good", () => {
  test("through a week, a later level up and its flag going off and on, a ready Leaderboard stays ready with its first readyAt and is never made ready again", async () => {
    const { t, alice } = await withMember();
    await levelReached(t, alice, 3);
    const ready = [{ feature: "leaderboard", state: "ready", readyAt: now.getTime(), openedAt: null }];

    vi.setSystemTime(now.getTime() + weekMs);
    await levelReached(t, alice, 4);
    expect(await unlocksOf(t, alice)).toEqual(ready);

    await boardTurned(t, "off");
    expect(await state(t, alice, "leaderboard")).toBe("unshipped");
    await levelReached(t, alice, 5);

    await boardTurned(t, "on");
    expect(await unlocksOf(t, alice)).toEqual(ready);
    expect(published("unlockReady")).toHaveLength(1);
  });

  test("a second open, a replayed levelReached, a later level up and the flag going off and on leave an opened Leaderboard open with its first times, publishing nothing and writing only the later level ups, which make nothing ready", async () => {
    const { t, alice } = await withMember();
    const reached = levelReachedEvent(alice, 3);
    await t.mutation(internal.unlocks.unlocks.makeReady, { event: reached });
    await open(t, alice, "leaderboard");
    const before = await everyTable(t);
    vi.mocked(publish).mockClear();

    vi.setSystemTime(now.getTime() + weekMs);
    expect(await open(t, alice, "leaderboard")).toBe("refused");
    await t.mutation(internal.unlocks.unlocks.makeReady, { event: reached });
    await levelReached(t, alice, 4);
    await boardTurned(t, "off");
    await levelReached(t, alice, 5);
    await boardTurned(t, "on");

    const laterLevelUps = [4, 5].map((level) => expect.objectContaining({ member: alice, level, ready: [] }));
    expect(await everyTable(t)).toEqual({ ...before, levelUps: [...before.levelUps!, ...laterLevelUps] });
    expect(await state(t, alice, "leaderboard")).toBe("open");
    expect(vi.mocked(publish)).not.toHaveBeenCalled();
  });
});

describe("P78: a feature that ships later is made ready once by the ship sweep", () => {
  test("a level 4 member's Leaderboard is made ready by the first sweep after everyone-board turns on; later sweeps and the flag going off and on write and publish nothing", async () => {
    const { t, alice } = await withMember();
    await withEarnings(t, alice, 300);
    await boardTurned(t, "off");
    await sweep(t);
    expect(await unlocksOf(t, alice)).toEqual([]);

    await boardTurned(t, "on");
    await sweep(t);
    expect(await unlocksOf(t, alice)).toEqual([{ feature: "leaderboard", state: "ready", readyAt: now.getTime(), openedAt: null }]);
    expect(published("unlockReady")).toEqual([{ type: "unlockReady", workspace: "T1", member: alice, feature: "leaderboard", at: now.getTime() }]);
    const before = await everyTable(t);
    vi.mocked(publish).mockClear();

    vi.setSystemTime(now.getTime() + weekMs);
    await sweep(t);
    await boardTurned(t, "off");
    await sweep(t);
    await boardTurned(t, "on");
    await sweep(t);

    expect(await everyTable(t)).toEqual(before);
    expect(vi.mocked(publish)).not.toHaveBeenCalled();
  });

  test("an opened Leaderboard stays open with its first times through sweeps and its flag going off and on", async () => {
    const { t, alice } = await withMember();
    await withEarnings(t, alice, 300);
    await sweep(t);
    await open(t, alice, "leaderboard");
    const before = await everyTable(t);

    await boardTurned(t, "off");
    await sweep(t);
    await boardTurned(t, "on");
    await sweep(t);

    expect(await everyTable(t)).toEqual(before);
    expect(await state(t, alice, "leaderboard")).toBe("open");
  });

  test("a member below the Leaderboard's level gets nothing from the sweep", async () => {
    const { t, alice } = await withMember();
    await withEarnings(t, alice, 19);

    await sweep(t);

    expect(await unlocksOf(t, alice)).toEqual([{ feature: "leaderboard", state: "locked", readyAt: null, openedAt: null }]);
    expect(published("unlockReady")).toEqual([]);
  });

  test("a sweep that makes the Leaderboard ready for 600 members schedules fewer than Convex's 1000 functions in each of its mutations, and every one of them ends up ready", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
    const { t } = await withMember();
    const members = await t.run(async (ctx) => {
      const ids: MemberId[] = [];
      for (let index = 0; index < 600; index += 1) {
        const member = await ctx.db.insert("members", { workspace: "T1", user: `U_${index}`, kind: "member", timeZone: "UTC" });
        await ctx.db.insert("memberProgress", { member, xp: 100, pointsSpent: 0 });
        ids.push(member);
      }
      return ids;
    });

    const scheduledPerPage = await sweepPageByPage(t);

    for (const scheduled of scheduledPerPage) expect(scheduled).toBeLessThan(1000);
    expect(scheduledPerPage.length).toBeGreaterThan(1);
    expect(published("unlockReady")).toHaveLength(members.length);
  }, 60_000);

  test("a page of level 5 members, each deciding every ship flag for themselves with capture on, fits in one mutation within Convex's transaction limits", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
    const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend({ transactionLimits: true })));
    await t.run(async (ctx) => {
      for (let index = 0; index < 100; index += 1) {
        const member = await ctx.db.insert("members", { workspace: "T1", user: `U_${index}`, kind: "member", timeZone: "UTC" });
        await ctx.db.insert("memberProgress", { member, xp: 600, pointsSpent: 0 });
      }
    });
    await flagsFromPostHog(t, postHog, ...["xp-levels", "unlocks", "everyone-board", "quests", "skill-tree"].map(onForEveryone));

    await sweepPageByPage(t);

    expect(published("unlockReady")).toHaveLength(100 * 3);
  }, 30_000);
});

async function sweepPageByPage(t: Backend) {
  const scheduledPerPage: number[] = [];
  let next: { cursor?: string } | undefined = {};
  while (next !== undefined) {
    await t.mutation(internal.unlocks.sweep.sweep, next);
    const scheduled = (await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).filter(({ state }) => state.kind === "pending");
    scheduledPerPage.push(scheduled.length);
    next = scheduled.find(({ name }) => name === "unlocks/sweep:sweep")?.args[0] as { cursor: string } | undefined;
    await t.run(async (ctx) => {
      for (const { _id } of scheduled) await ctx.scheduler.cancel(_id);
    });
  }
  return scheduledPerPage;
}

function sweep(t: Backend) {
  return t.mutation(internal.unlocks.sweep.sweep, {});
}

function boardTurned(t: Backend, value: "on" | "off") {
  return flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), (value === "on" ? onForEveryone : offForEveryone)("everyone-board"));
}

async function withMember() {
  const t = await unlocksShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  const alice = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member", timeZone: "UTC" }));
  return { t, alice };
}

async function withEarnings(t: Backend, member: MemberId, xp: number) {
  await t.run(async (ctx) => {
    const award = await ctx.db.insert("awards", { workspace: "T1", conversation: "C1", message: "1.0", giver: member, recipient: member, kudos: 1, day: "2026-10-13", at: now.getTime() });
    await ctx.db.insert("effectsRecords", { award, side: "giver", member, day: "2026-10-13", baseXp: xp, gate: null, catalogueVersion: "1" });
    await ctx.db.insert("memberProgress", { member, xp, pointsSpent: 0 });
  });
}

function levelReachedEvent(member: MemberId, level: number): LevelReachedEvent {
  return {
    type: "levelReached",
    workspace: "T1",
    member,
    level,
    skillPointsGained: 0,
    skillPoints: 0,
    xpToNextLevel: 100,
    message: { workspace: "T1", conversation: "C1", message: "1760349600.000100" },
    at: Date.now(),
  };
}

function levelReached(t: Backend, member: MemberId, level: number) {
  return t.mutation(internal.unlocks.unlocks.makeReady, { event: levelReachedEvent(member, level) });
}

function open(t: Backend, member: MemberId, feature: Feature) {
  return t.run((ctx) => openUnlock(ctx, member, feature, "slack"));
}

function unlocksOf(t: Backend, member: MemberId) {
  return t.query(internal.unlocks.unlocks.memberUnlocks, { member });
}

function state(t: Backend, member: MemberId, feature: Feature) {
  return t.run((ctx) => stateOf(ctx, member, feature));
}

function published(type: "unlockReady" | "unlockOpened") {
  return vi
    .mocked(publish)
    .mock.calls.map(([, event]) => event)
    .filter((event) => event.type === type);
}

async function everyTable(t: Backend) {
  return t.run(async (ctx) => {
    const tables: Record<string, unknown[]> = {};
    for (const table of Object.keys(schema.tables) as Array<keyof typeof schema.tables>) tables[table] = await ctx.db.query(table).collect();
    return tables as Record<keyof typeof schema.tables, Array<Record<string, unknown>>>;
  });
}
