import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEventWithAward } from "../../testing/busEvents";
import { FakeSlack } from "../../testing/fakeSlack";
import { flagsLoaded, flagsOnForEveryone, journeyShippedBeforeAnyoneJoined, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { settle, testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { DomainEvent, KudosGivenEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { standingOf } from "../progression/progression";
import type { MemberId } from "../workspace/directory";
import { advanceJourney, journey } from "./journey";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-13T10:00:00Z");
const saysWhy = { gate: { version: 1, thoughtful: true, words: 7 } };
const doesNotSayWhy = { gate: { version: 1, thoughtful: false, words: 1 } };

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "quests");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P8 P87: a Journey step's reward is recorded once", () => {
  const recordEffects = internal.progression.progression.recordEffects;
  const followJourney = internal.quests.quests.followKudosGiven;

  test.each([
    ["progression's recordEffects first", [recordEffects, followJourney]],
    ["the Journey's subscriber first", [followJourney, recordEffects]],
  ] as const)("delivering the same kudosGiven twice, %s, pays 10 XP once and reaches level 2 once", async (_, subscribers) => {
    const { t, alice, bob } = await withMembers();
    const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { annotations: saysWhy }));

    for (const delivery of [1, 2]) {
      for (const subscriber of subscribers) await t.mutation(subscriber, { event });
    }
    await settle(t);

    expect(await t.run((ctx) => standingOf(ctx, alice))).toEqual({ xp: 20, level: 2, skillPoints: 0 });
    expect(published("levelReached").map(({ member, level }) => ({ member, level }))).toEqual([{ member: alice, level: 2 }]);
    expect(published("questFinished")).toEqual([{ type: "questFinished", workspace: "T1", member: alice, quest: { kind: "journey", step: "first-thanks" }, at: event.at }]);
    expect(await journeyOf(t, alice)).toEqual([
      { step: "first-thanks", activatedAt: event.at, reward: { xp: 10, coins: 0, item: null }, catalogueVersion: "1", finishedAt: event.at, openedAt: null },
    ]);
  });

  test("P64: a level reached through the reward record is published without a kudos message", async () => {
    const { t, alice, bob } = await withMembers();
    const event = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { annotations: saysWhy }));

    await t.mutation(recordEffects, { event });
    await t.mutation(followJourney, { event });

    expect(published("levelReached")).toEqual([
      { type: "levelReached", workspace: "T1", member: alice, level: 2, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 80, at: event.at },
    ]);
  });
});

describe("P86: the reward is the one promised when the step became active", () => {
  test("a catalogue change between activation and finishing doesn't change what the record pays", async () => {
    const { t, alice, bob } = await withMembers();
    const activatedAt = now.getTime();
    await advance(t, await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { annotations: doesNotSayWhy })));
    vi.setSystemTime(activatedAt + 60_000);
    const retuned = { version: "2", steps: [{ step: "first-thanks", reward: { xp: 25, coins: 0, item: null } }] } as const;

    const finished = await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { annotations: saysWhy, at: Date.now() }));
    await t.run((ctx) => advanceJourney(ctx, finished, retuned));

    expect(await t.run((ctx) => standingOf(ctx, alice))).toEqual({ xp: 10, level: 1, skillPoints: 0 });
    expect(await journeyOf(t, alice)).toEqual([
      { step: "first-thanks", activatedAt, reward: { xp: 10, coins: 0, item: null }, catalogueVersion: "1", finishedAt: finished.at, openedAt: null },
    ]);
  });
});

describe("P79: questsOf gives the website each Journey step's facts", () => {
  test("no step before the member is seen, the active step with its promise, then its finish", async () => {
    const { t, alice, bob } = await withMembers();
    expect(await questsOf(t, alice)).toEqual({ journey: [], week: null });

    await advance(t, await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { annotations: doesNotSayWhy })));
    const active = { step: "first-thanks", activatedAt: now.getTime(), reward: { xp: 10, coins: 0, item: null }, catalogueVersion: "1" };
    expect(await questsOf(t, alice)).toEqual({ journey: [{ ...active, finishedAt: null, openedAt: null }], week: null });

    vi.setSystemTime(now.getTime() + 60_000);
    await advance(t, await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { annotations: saysWhy, at: Date.now() })));
    expect(await questsOf(t, alice)).toEqual({ journey: [{ ...active, finishedAt: now.getTime() + 60_000, openedAt: null }], week: null });
  });
});

describe("the slice applies only where quests, xp-levels and unlocks all apply", () => {
  test.each([
    ["quests is off", ["xp-levels", "unlocks"]],
    ["xp-levels is off", ["quests", "unlocks"]],
    ["unlocks is off", ["quests", "xp-levels"]],
  ])("while %s, a kudos that says why records nothing for the Journey and questsOf shows nothing", async (_, on) => {
    flagsOnForEveryone(new FakeSlack().fetch, ...on);
    const { t, alice, bob } = await withMembers();

    await deliver(t, await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { annotations: saysWhy })));

    expect(await stored(t)).toEqual({ journeySteps: [], rewardRecords: [] });
    expect(published("questFinished")).toEqual([]);
    expect(await questsOf(t, alice)).toBeNull();
  });

  test("while unlocks is on but hasn't launched in the workspace, a kudos that says why records nothing and questsOf shows nothing, until Unlocks launches", async () => {
    const { t, alice, bob } = await withMembersBeforeUnlocksLaunched();

    await deliver(t, await t.run((ctx) => kudosGivenEventWithAward(ctx, alice, bob, { annotations: saysWhy })));

    expect(await stored(t)).toEqual({ journeySteps: [], rewardRecords: [] });
    expect(await t.run((ctx) => standingOf(ctx, alice))).toEqual({ xp: 0, level: 1, skillPoints: 0 });
    expect(await questsOf(t, alice)).toBeNull();

    await unlocksShippedBeforeAnyoneJoined(t);

    expect(await questsOf(t, alice)).toEqual({ journey: [], week: null });
  });
});

async function withMembers() {
  const t = await journeyShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  return membersOf(t);
}

async function withMembersBeforeUnlocksLaunched() {
  return membersOf(await flagsLoaded(testBackend()));
}

async function membersOf(t: Backend) {
  const [alice, bob] = await t.run(async (ctx) => [
    await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" }),
  ]);
  return { t, alice: alice!, bob: bob! };
}

async function advance(t: Backend, event: KudosGivenEvent) {
  await t.run((ctx) => advanceJourney(ctx, event, journey));
}

async function deliver(t: Backend, event: KudosGivenEvent) {
  await t.mutation(internal.quests.quests.followKudosGiven, { event });
}

async function questsOf(t: Backend, member: MemberId) {
  return t.query(internal.quests.quests.questsOf, { member });
}

async function journeyOf(t: Backend, member: MemberId) {
  return (await questsOf(t, member))?.journey;
}

async function stored(t: Backend) {
  return t.run(async (ctx) => ({ journeySteps: await ctx.db.query("journeySteps").collect(), rewardRecords: await ctx.db.query("rewardRecords").collect() }));
}

function published<T extends DomainEvent["type"]>(type: T) {
  return vi
    .mocked(publish)
    .mock.calls.map(([, event]) => event)
    .filter((event): event is Extract<DomainEvent, { type: T }> => event.type === type);
}
