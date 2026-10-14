import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, journeyShippedBeforeAnyoneJoined } from "../../testing/flags";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { DomainEvent, KudosGivenEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { standingOf } from "../progression/progression";
import type { MemberId } from "../workspace/directory";
import type { QuestId } from "./pool";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const tuesday = Date.parse("2026-10-13T10:00:00Z");
const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
const weekMs = 7 * dayMs;
const saysWhy = { gate: { version: 1, thoughtful: true, words: 7 } };
const doesNotSayWhy = { gate: { version: 1, thoughtful: false, words: 1 } };
const kudosXp = 10;
const weeklyQuestXp = 20;
const firstThanksXp = 10;
const advance = internal.quests.quests.followKudosGiven;
const recordEffects = internal.progression.progression.recordEffects;

beforeEach(() => {
  vi.useFakeTimers({ now: tuesday });
  vi.mocked(publish).mockClear();
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "quests", "everyone-board");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P84 P87: a weekly quest's progress and finish are recorded once", () => {
  test.each([
    ["progression's recordEffects first", [recordEffects, advance]],
    ["Quests' subscriber first", [advance, recordEffects]],
  ] as const)("the same kudosGiven delivered twice, %s, counts once and finishes once with one 20 XP reward record", async (_, subscribers) => {
    const { t, alice, bob } = await workspace();
    await drawn(t, alice, ["say-why", "say-why-twice", "say-why-three-times"]);
    const event = await given(t, alice, bob, { annotations: saysWhy });

    for (const delivery of [1, 2]) {
      for (const subscriber of subscribers) await t.mutation(subscriber, { event });
    }
    await settle(t);

    expect(await weeklyRewardRecords(t)).toEqual([{ key: "weekly:2026-10-12:0", xp: 20, coins: 0, item: null, catalogueVersion: "1", at: event.at }]);
    expect(await t.run((ctx) => standingOf(ctx, alice))).toEqual({ xp: kudosXp + weeklyQuestXp + firstThanksXp, level: 2, skillPoints: 0 });
    expect(publishedWeeklyFinishes()).toEqual([{ type: "questFinished", workspace: "T1", member: alice, quest: { kind: "weekly", week: "2026-10-12", slot: 0 }, at: event.at }]);
    expect(await progressOf(t, alice)).toEqual([
      { quest: "say-why", progress: 1, finishedAt: event.at, openedAt: null },
      { quest: "say-why-twice", progress: 1, finishedAt: null, openedAt: null },
      { quest: "say-why-three-times", progress: 1, finishedAt: null, openedAt: null },
    ]);
  });

  test("a finished quest doesn't finish again, and a later kudos counts only toward the quests still open", async () => {
    const { t, alice, bob, carol } = await workspace();
    await drawn(t, alice, ["say-why", "say-why-twice", "say-why-three-times"]);

    await t.mutation(advance, { event: await given(t, alice, bob, { annotations: saysWhy }) });
    await t.mutation(advance, { event: await given(t, alice, carol, { annotations: saysWhy, message: messageAt(2) }) });

    expect((await weeklyRewardRecords(t)).map(({ key }) => key)).toEqual(["weekly:2026-10-12:0", "weekly:2026-10-12:1"]);
    expect(publishedWeeklyFinishes()).toHaveLength(2);
    expect((await progressOf(t, alice)).map(({ progress }) => progress)).toEqual([1, 2, 2]);
  });

  test("P16: a second kudos that says why to the same person on the same day is no second recognition, while one on another day is", async () => {
    const { t, alice, bob } = await workspace();
    await drawn(t, alice, ["say-why-twice", "say-why-two-days", "say-why-three-times"]);

    await t.mutation(advance, { event: await given(t, alice, bob, { annotations: saysWhy }) });
    await t.mutation(advance, { event: await given(t, alice, bob, { annotations: saysWhy, message: messageAt(2) }) });
    expect((await progressOf(t, alice)).map(({ progress }) => progress)).toEqual([1, 1, 1]);

    await t.mutation(advance, { event: await given(t, alice, bob, { annotations: saysWhy, message: messageAt(3), at: tuesday + dayMs, day: "2026-10-14" }) });
    expect((await progressOf(t, alice)).map(({ progress }) => progress)).toEqual([2, 2, 2]);
  });

  test("a kudos that doesn't say why moves only the goals that don't ask for it, and records nothing for the others", async () => {
    const { t, alice, bob } = await workspace();
    await drawn(t, alice, ["say-why", "someone-new", "say-why-two-days"]);

    await t.mutation(advance, { event: await given(t, alice, bob, { annotations: doesNotSayWhy }) });

    expect((await progressOf(t, alice)).map(({ progress }) => progress)).toEqual([0, 1, 0]);
    expect(await t.run((ctx) => ctx.db.query("questProgress").collect())).toHaveLength(1);
  });

  test("a kudos to someone thanked before doesn't count toward thanking someone new", async () => {
    const { t, alice, bob } = await workspace();
    await given(t, alice, bob, { at: tuesday - 2 * dayMs, day: "2026-10-11" });
    await drawn(t, alice, ["someone-new", "say-why", "not-in-30-days"]);

    await t.mutation(advance, { event: await given(t, alice, bob, { annotations: saysWhy }) });

    expect((await progressOf(t, alice)).map(({ progress }) => progress)).toEqual([0, 1, 0]);
  });
});

describe("P84: progress counts only awards after the draw and within its week", () => {
  test.each([
    ["an hour before the draw", tuesday - hourMs, "2026-10-13"],
    ["in the week before", tuesday - weekMs, "2026-10-06"],
    ["in the week after", tuesday + weekMs, "2026-10-20"],
  ])("a kudos that says why %s counts nothing", async (_, at, day) => {
    const { t, alice, bob } = await workspace();
    await drawn(t, alice, ["say-why", "say-why-twice", "someone-new"]);

    await t.mutation(advance, { event: await given(t, alice, bob, { annotations: saysWhy, at, day }) });

    expect(await weeklyRewardRecords(t)).toEqual([]);
    expect((await progressOf(t, alice)).map(({ progress }) => progress)).toEqual([0, 0, 0]);
  });

  test("a member with no draw this week records nothing", async () => {
    const { t, alice, bob } = await workspace();

    await t.mutation(advance, { event: await given(t, alice, bob, { annotations: saysWhy }) });

    expect(await t.run((ctx) => ctx.db.query("questProgress").collect())).toEqual([]);
    expect(await weeklyRewardRecords(t)).toEqual([]);
  });
});

describe("the slice applies only where quests, xp-levels and unlocks all apply", () => {
  test("while quests is off, a kudos records no progress and no reward", async () => {
    flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "everyone-board");
    const { t, alice, bob } = await workspace();
    await drawn(t, alice, ["say-why", "say-why-twice", "someone-new"]);

    await t.mutation(advance, { event: await given(t, alice, bob, { annotations: saysWhy }) });

    expect(await t.run((ctx) => ctx.db.query("questProgress").collect())).toEqual([]);
    expect(await weeklyRewardRecords(t)).toEqual([]);
  });
});

describe("P87 P6: a level crossed by a weekly quest's reward record", () => {
  test("publishes levelReached once without a kudos message, and level 3 makes the Leaderboard ready", async () => {
    const { t, alice, bob } = await workspace();
    await t.run((ctx) => ctx.db.insert("memberProgress", { member: alice, xp: 80, pointsSpent: 0 }));
    await drawn(t, alice, ["say-why", "say-why-twice", "someone-new"]);
    const event = await given(t, alice, bob, { annotations: saysWhy });

    await t.mutation(advance, { event });
    await t.mutation(advance, { event });
    await settle(t);

    expect(published("levelReached")).toEqual([
      { type: "levelReached", workspace: "T1", member: alice, level: 3, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 200, at: event.at },
    ]);
    const unlocks = await t.query(internal.unlocks.unlocks.memberUnlocks, { member: alice });
    expect(unlocks.find(({ feature }) => feature === "leaderboard")?.state).toBe("ready");
  });
});

async function workspace() {
  const t = await journeyShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  const [alice, bob, carol] = await t.run(async (ctx) => [
    await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_CAROL", kind: "member" }),
  ]);
  return { t, alice: alice!, bob: bob!, carol: carol! };
}

async function drawn(t: Backend, member: MemberId, quests: QuestId[]) {
  const slots = quests.map((quest, slot) => ({
    slot,
    quest,
    reward: { xp: 20, coins: 0, item: null },
    catalogueVersion: "1",
    feasibleBecause: { peopleLeft: 1, recognitionsLeft: 18 },
  }));
  await t.run((ctx) => ctx.db.insert("questDraws", { member, week: "2026-10-12", drawnAt: tuesday, slots }));
}

function given(t: Backend, giver: MemberId, recipient: MemberId, overrides: Partial<KudosGivenEvent> = {}) {
  return t.run((ctx) => kudosGivenEventWithAward(ctx, giver, recipient, overrides));
}

function messageAt(sequence: number) {
  return { workspace: "T1", conversation: "C1", message: `1760349600.00010${sequence}` };
}

async function weeklyRewardRecords(t: Backend) {
  const records = await t.run((ctx) => ctx.db.query("rewardRecords").collect());
  return records.filter(({ key }) => key.startsWith("weekly:")).map(({ key, xp, coins, item, catalogueVersion, at }) => ({ key, xp, coins, item, catalogueVersion, at }));
}

async function progressOf(t: Backend, member: MemberId) {
  const week = (await t.query(internal.quests.quests.questsOf, { member }))!.week!;
  return week.slots.map(({ quest, progress, finishedAt, openedAt }) => ({ quest, progress, finishedAt, openedAt }));
}

function published<T extends DomainEvent["type"]>(type: T) {
  return vi
    .mocked(publish)
    .mock.calls.map(([, event]) => event)
    .filter((event): event is Extract<DomainEvent, { type: T }> => event.type === type);
}

function publishedWeeklyFinishes() {
  return published("questFinished").filter((event) => event.type === "questFinished" && event.quest.kind === "weekly");
}
