import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEvent } from "../../testing/busEvents";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsLoaded, flagsOnForEveryone } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { DomainEvent, KudosGivenEvent } from "../bus/events";
import { publish } from "../bus/publish";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "achievements");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("P59 P61 P93: a tier is earned once and never taken back", () => {
  test("the kudos that reaches 25 given earns Generosity silver once, dated by it; delivering its kudosGiven twice counts it once and publishes achievementEarned once", async () => {
    const { t, alice, bob } = await withMembers();
    await count(t, await kudosGiven(t, alice, bob, { kudos: 24, at: now.getTime() }));
    const reaching = await kudosGiven(t, alice, bob, { kudos: 1, at: now.getTime() + minuteMs });

    await count(t, reaching);
    await count(t, reaching);

    const generosity = await ladderOf(t, alice, "generosity");
    expect(generosity.count).toBe(25);
    expect(generosity.earned.map(({ tier, earnedAt }) => ({ tier, earnedAt }))).toEqual([
      { tier: "bronze", earnedAt: now.getTime() },
      { tier: "silver", earnedAt: reaching.at },
    ]);
    expect(earned().filter(({ member }) => member === alice)).toEqual([
      { type: "achievementEarned", workspace: "T1", member: alice, ladder: "generosity", tier: "bronze", at: now.getTime() },
      { type: "achievementEarned", workspace: "T1", member: alice, ladder: "generosity", tier: "silver", at: reaching.at },
    ]);
  });

  test("a kudos after a tier is earned keeps it, with its first date, and earns it no second time", async () => {
    const { t, alice, bob } = await withMembers();
    await count(t, await kudosGiven(t, alice, bob, { kudos: 1, at: now.getTime() }));

    await count(t, await kudosGiven(t, alice, bob, { kudos: 1, at: now.getTime() + minuteMs }));

    expect((await ladderOf(t, alice, "generosity")).earned.map(({ tier, earnedAt }) => ({ tier, earnedAt }))).toEqual([{ tier: "bronze", earnedAt: now.getTime() }]);
    expect(earned().filter(({ member, ladder }) => member === alice && ladder === "generosity")).toHaveLength(1);
  });
});

describe("P79: achievementsOf gives the website each ladder's facts", () => {
  test("it returns each ladder's count, every earned tier with its date, catalogue version and promised rewards, and the next tier with its count", async () => {
    const { t, alice, bob } = await withMembers();

    await count(t, await kudosGiven(t, alice, bob, { kudos: 3, at: now.getTime() }));

    expect(await t.query(internal.achievements.achievements.achievementsOf, { member: bob })).toEqual({
      ladders: [
        { ladder: "generosity", count: 0, earned: [], next: { tier: "bronze", count: 1, rewards: [{ kind: "coins", reward: "generosity-bronze-coins" }] } },
        {
          ladder: "recognition",
          count: 3,
          earned: [{ tier: "bronze", earnedAt: now.getTime(), catalogueVersion: "1", rewards: [{ kind: "coins", reward: "recognition-bronze-coins" }] }],
          next: { tier: "silver", count: 25, rewards: [{ kind: "kudosEmoji", reward: "recognition-silver-kudos-emoji" }] },
        },
      ],
    });
  });

  test("a member past 500 has every tier in ladder order, diamond with both its rewards, and no next tier", async () => {
    const { t, alice, bob } = await withMembers();

    await count(t, await kudosGiven(t, alice, bob, { kudos: 500, at: now.getTime() }));

    const generosity = await ladderOf(t, alice, "generosity");
    expect(generosity.earned.map(({ tier }) => tier)).toEqual(["bronze", "silver", "gold", "diamond"]);
    expect(generosity.earned[3]?.rewards).toEqual([
      { kind: "coins", reward: "generosity-diamond-coins" },
      { kind: "hedgehog", reward: "generosity-diamond-hedgehog" },
    ]);
    expect(generosity.next).toBeNull();
  });
});

async function withMembers() {
  const t = await bookShippedBeforeAnyoneJoined(await flagsLoaded(testBackend()));
  const [alice, bob] = await t.run(async (ctx) => [
    await ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }),
    await ctx.db.insert("members", { workspace: "T1", user: "U_BOB", kind: "member" }),
  ]);
  return { t, alice: alice!, bob: bob! };
}

async function kudosGiven(t: Backend, giver: MemberId, recipient: MemberId, { kudos, at }: { kudos: number; at: number }): Promise<KudosGivenEvent> {
  return t.run(async (ctx) => {
    const event = kudosGivenEvent(giver, recipient, { at });
    const { workspace, conversation, message } = event.message;
    const award = await ctx.db.insert("awards", { workspace, conversation, message, giver, recipient, kudos, day: event.day, at });
    return { ...event, awards: [{ award, giver, recipient, kudos }] };
  });
}

async function count(t: Backend, event: KudosGivenEvent) {
  await t.mutation(internal.achievements.achievements.countKudosGiven, { event });
}

async function ladderOf(t: Backend, member: MemberId, ladder: "generosity" | "recognition") {
  const facts = await t.query(internal.achievements.achievements.achievementsOf, { member });
  return facts!.ladders.find((entry) => entry.ladder === ladder)!;
}

function earned() {
  return vi
    .mocked(publish)
    .mock.calls.map(([, event]) => event)
    .filter((event): event is Extract<DomainEvent, { type: "achievementEarned" }> => event.type === "achievementEarned");
}
