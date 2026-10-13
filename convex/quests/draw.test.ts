import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { Feature } from "../unlocks/feature";
import type { MemberId } from "../workspace/directory";
import { drawFactsOf } from "./weekly";

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const sunday = Date.parse("2026-10-18T10:00:00Z");
const dayMs = 24 * 60 * 60 * 1000;
const weekMs = 7 * dayMs;
const overDays = ["say-why-two-days", "say-why-three-days"];
const someoneNew = ["someone-new", "two-new"];

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "quests");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P80: opening Quests draws 3 different quests the member can finish this week", () => {
  test("questsOf gives the week key, the draw time and each slot's quest, goal, promised reward and the facts that made it feasible", async () => {
    const { t, alice } = await workspace();

    await openQuests(t, alice, tuesday);

    const week = (await questsOf(t, alice))!.week!;
    expect(week).toMatchObject({ week: "2026-10-12", drawnAt: tuesday });
    expect(week.slots.map(({ slot }) => slot)).toEqual([0, 1, 2]);
    for (const slot of week.slots) {
      expect(slot).toEqual({
        slot: slot.slot,
        quest: expect.any(String),
        goal: expect.stringMatching(/^Thank /),
        reward: { xp: 20, coins: 0, item: null },
        catalogueVersion: "1",
        feasibleBecause: { peopleLeft: expect.any(Number), recognitionsLeft: 18, ...(overDays.includes(slot.quest) && { daysLeft: 6 }) },
        progress: 0,
        target: expect.any(Number),
        finishedAt: null,
        openedAt: null,
      });
    }
    expect(new Set(week.slots.map(({ quest }) => quest)).size).toBe(3);
  });

  test("opened on a Sunday, every week, the draw holds 3 quests and none over 2 or more days", async () => {
    const { t, alice } = await workspace();

    for (const week of weeks(12)) {
      await openQuests(t, alice, sunday + week * weekMs);
      const slots = await drawnOn(t, alice, sunday + week * weekMs);
      expect(slots).toHaveLength(3);
      expect(slots.filter((quest) => overDays.includes(quest))).toEqual([]);
    }
  });

  test("on a Sunday, a member who already spent 1 of 3 kudos today never gets a goal that needs 3 recognitions, and one with none left gets nothing drawn", async () => {
    const { t, alice, bob } = await workspace();
    await t.run((ctx) => ctx.db.insert("workspaces", { workspace: "T1", baseAllowance: 3 }));

    for (const week of weeks(12)) {
      const at = sunday + week * weekMs;
      await spent(t, alice, at, 1);
      await openQuests(t, alice, at);
      expect((await drawnOn(t, alice, at)).filter((quest) => quest === "say-why-three-times")).toEqual([]);
    }
    await spent(t, bob, sunday, 3);
    await openQuests(t, bob, sunday);
    expect(await drawnOn(t, bob, sunday)).toEqual([]);
  });

  test("a draw that runs after the opening checks the facts at the draw: an opening late on Saturday drawn on Sunday holds no goal over 2 days", async () => {
    const { t, alice } = await workspace();

    for (const week of weeks(12)) {
      const drawnAt = sunday + week * weekMs;
      vi.setSystemTime(drawnAt);
      await t.mutation(internal.quests.weekly.drawWeeklyQuests, { event: { type: "unlockOpened", workspace: "T1", member: alice, feature: "quests", at: drawnAt - 11 * 60 * 60 * 1000 } });
      const drawn = (await questsOf(t, alice))!.week!;
      expect(drawn.drawnAt).toBe(drawnAt);
      expect(drawn.slots.filter(({ quest }) => overDays.includes(quest))).toEqual([]);
    }
  });

  test("a member who has thanked everyone never gets a thank someone new quest, while one who hasn't does in some week", async () => {
    const { t, alice, bob } = await workspace();
    const carol = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_CAROL", kind: "member" }));
    await thanks(t, alice, bob, tuesday - dayMs);
    await thanks(t, alice, carol, tuesday - dayMs);

    const drawnForAlice: string[] = [];
    const drawnForBob: string[] = [];
    for (const week of weeks(12)) {
      await openQuests(t, alice, tuesday + week * weekMs);
      await openQuests(t, bob, tuesday + week * weekMs);
      drawnForAlice.push(...(await drawnOn(t, alice, tuesday + week * weekMs)));
      drawnForBob.push(...(await drawnOn(t, bob, tuesday + week * weekMs)));
    }

    expect(drawnForAlice.filter((quest) => someoneNew.includes(quest))).toEqual([]);
    expect(drawnForBob.filter((quest) => someoneNew.includes(quest))).not.toEqual([]);
  });

  test("someone last thanked 30 or more days ago counts as someone not thanked in 30 days", async () => {
    const { t, alice, bob } = await workspace();
    await thanks(t, alice, bob, tuesday - 30 * dayMs);

    await openQuests(t, alice, tuesday);

    const slots = (await questsOf(t, alice))!.week!.slots;
    for (const slot of slots.filter(({ quest }) => quest === "not-in-30-days")) expect(slot.feasibleBecause).toEqual({ peopleLeft: 1, recognitionsLeft: 18 });
    expect(await peopleLeftAt(t, alice, tuesday)).toEqual({ anyone: 1, "someone-new": 0, "someone-not-thanked-in-30-days": 1 });
    expect(await peopleLeftAt(t, alice, tuesday - dayMs)).toEqual({ anyone: 1, "someone-new": 0, "someone-not-thanked-in-30-days": 0 });
  });
});

describe("P80: the draw is deterministic per member and week, and stored once", () => {
  test("opening twice in a week draws once, at the first opening", async () => {
    const { t, alice } = await workspace();
    await openQuests(t, alice, tuesday);
    const first = await questsOf(t, alice);

    await openQuests(t, alice, tuesday + dayMs);

    expect(await questsOf(t, alice)).toEqual(first);
    expect(await t.run((ctx) => ctx.db.query("questDraws").collect())).toHaveLength(1);
  });

  test("the same member and week give the same quests on another backend with the same facts", async () => {
    const one = await workspace();
    const other = await workspace();
    expect(other.alice).toBe(one.alice);

    await openQuests(one.t, one.alice, tuesday);
    await openQuests(other.t, other.alice, tuesday + dayMs);

    expect(await drawnOn(other.t, other.alice, tuesday)).toEqual(await drawnOn(one.t, one.alice, tuesday));
  });

  test("different weeks draw from the pool independently", async () => {
    const { t, alice } = await workspace();
    const draws = new Set<string>();

    for (const week of weeks(8)) {
      await openQuests(t, alice, tuesday + week * weekMs);
      draws.add((await drawnOn(t, alice, tuesday + week * weekMs)).join());
    }

    expect(draws.size).toBeGreaterThan(1);
  });
});

describe("P80: the member's week starts Monday 00:00 in their time zone, or in UTC without one", () => {
  test.each([
    ["without a time zone, Sunday in UTC", undefined, "2026-10-12", false],
    ["in Pacific/Auckland, already Monday", "Pacific/Auckland", "2026-10-19", true],
  ])("at Sunday 12:00 UTC, a member %s draws for the week of %s", async (_, timeZone, weekKey, overDaysFeasible) => {
    const { t, alice } = await workspace({ timeZone });
    const sundayNoon = Date.parse("2026-10-18T12:00:00Z");

    await openQuests(t, alice, sundayNoon);

    const week = (await questsOf(t, alice))!.week!;
    expect(week.week).toBe(weekKey);
    expect(await daysLeftAt(t, alice, sundayNoon)).toBe(overDaysFeasible ? 7 : 1);
  });
});

describe("P75: quests are drawn only once Quests is open, and only where the slice applies", () => {
  test("opening another feature draws nothing", async () => {
    const { t, alice } = await workspace();

    await opened(t, alice, "leaderboard", tuesday);

    expect((await questsOf(t, alice))!.week).toBeNull();
  });

  test("while quests is off, opening Quests draws nothing", async () => {
    flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks");
    const { t, alice } = await workspace();

    await openQuests(t, alice, tuesday);

    expect(await t.run((ctx) => ctx.db.query("questDraws").collect())).toEqual([]);
  });

  test("a member opened into Quests before any teammate is in the directory has no draw stored, and draws 3 once one is", async () => {
    const t = await flagsLoaded(testBackend());
    await unlocksShippedBeforeAnyoneJoined(t);
    const alice = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }));

    await openQuests(t, alice, tuesday);
    expect(await t.run((ctx) => ctx.db.query("questDraws").collect())).toEqual([]);
    expect((await questsOf(t, alice))!.week).toBeNull();

    await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" }));
    await openQuests(t, alice, tuesday + dayMs);

    expect(await drawnOn(t, alice, tuesday + dayMs)).toHaveLength(3);
  });

  test("questsOf shows no week before the member opened Quests this week", async () => {
    const { t, alice } = await workspace();
    await openQuests(t, alice, tuesday);

    vi.setSystemTime(tuesday + weekMs);

    expect((await questsOf(t, alice))!.week).toBeNull();
  });
});

describe("P77: launching unlocks for members already playing stays within Convex's limits", () => {
  test.each([
    ["Quests and the Leaderboard both ship", ["xp-levels", "unlocks", "quests", "everyone-board"], 600],
    ["quests is dark and the Leaderboard ships", ["xp-levels", "unlocks", "everyone-board"], 0],
  ])("when %s, launching for 600 members schedules one draw per member opened into Quests and nothing else", async (_, flags, draws) => {
    flagsOnForEveryone(new FakeSlack().fetch, ...flags);
    const t = await flagsLoaded(testBackend());
    await t.run(async (ctx) => {
      for (let index = 0; index < 600; index += 1) await ctx.db.insert("members", { workspace: "T1", user: `U_${index}`, kind: "member" });
    });

    await unlocksShippedBeforeAnyoneJoined(t);

    expect(await scheduled(t)).toEqual({ total: draws, draws });
  });
});

async function scheduled(t: Backend) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return { total: jobs.length, draws: jobs.filter(({ name }) => name.includes("drawWeeklyQuests")).length };
}

async function workspace({ timeZone }: { timeZone?: string } = {}) {
  const t = await flagsLoaded(testBackend());
  await unlocksShippedBeforeAnyoneJoined(t);
  const [alice, bob] = await t.run(async (ctx) => [
    await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member", ...(timeZone && { timeZone }) }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" }),
  ]);
  return { t, alice: alice!, bob: bob! };
}

async function openQuests(t: Backend, member: MemberId, at: number) {
  await opened(t, member, "quests", at);
}

async function opened(t: Backend, member: MemberId, feature: Feature, at: number) {
  vi.setSystemTime(at);
  await t.mutation(internal.quests.weekly.drawWeeklyQuests, { event: { type: "unlockOpened", workspace: "T1", member, feature, at } });
  await settle(t);
}

async function thanks(t: Backend, giver: MemberId, recipient: MemberId, at: number) {
  await t.run((ctx) => kudosGivenEventWithAward(ctx, giver, recipient, { at, day: new Date(at).toISOString().slice(0, 10) }));
}

async function spent(t: Backend, giver: MemberId, at: number, kudos: number) {
  await t.run((ctx) => ctx.db.insert("allowanceSpending", { giver, day: new Date(at).toISOString().slice(0, 10), spent: kudos }));
}

async function questsOf(t: Backend, member: MemberId) {
  return t.query(internal.quests.quests.questsOf, { member });
}

async function drawnOn(t: Backend, member: MemberId, at: number) {
  vi.setSystemTime(at);
  return ((await questsOf(t, member))?.week?.slots ?? []).map(({ quest }) => quest);
}

async function peopleLeftAt(t: Backend, member: MemberId, at: number) {
  return (await t.run((ctx) => drawFactsOf(ctx, member, at))).peopleLeft;
}

async function daysLeftAt(t: Backend, member: MemberId, at: number) {
  return (await t.run((ctx) => drawFactsOf(ctx, member, at))).daysLeft;
}

function weeks(count: number) {
  return Array.from({ length: count }, (_, week) => week);
}
