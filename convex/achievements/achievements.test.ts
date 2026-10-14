import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { kudosGivenEvent } from "../../testing/busEvents";
import type { FakePostHog } from "../../testing/fakePostHog";
import { FakeSlack } from "../../testing/fakeSlack";
import { bookShippedBeforeAnyoneJoined, flagsFromPostHog, flagsLoaded, flagsOnForEveryone, offForEveryone, onForEveryone, unlocksShippedBeforeAnyoneJoined } from "../../testing/flags";
import { testBackend, type Backend } from "../../testing/slackBackend";
import { internal } from "../_generated/api";
import type { DomainEvent, KudosGivenEvent } from "../bus/events";
import type { LadderFacts } from "./achievements";
import type { LadderId } from "./ladders";
import { publish } from "../bus/publish";
import type { MemberId } from "../workspace/directory";

vi.mock("../bus/publish", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../bus/publish")>();
  return { ...actual, publish: vi.fn(actual.publish) };
});

const now = new Date("2026-10-13T10:00:00Z");
const minuteMs = 60_000;

let postHog: FakePostHog;

beforeEach(() => {
  vi.useFakeTimers({ now });
  vi.mocked(publish).mockClear();
  vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-test");
  postHog = flagsOnForEveryone(new FakeSlack().fetch, "xp-levels", "unlocks", "achievements");
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
    expect(earnedIn(generosity)).toEqual([
      { tier: "bronze", earnedAt: now.getTime() },
      { tier: "silver", earnedAt: reaching.at },
    ]);
    expect(earned().filter(({ member, ladder }) => member === alice && ladder === "generosity")).toEqual([
      { type: "achievementEarned", workspace: "T1", member: alice, ladder: "generosity", tier: "bronze", at: now.getTime() },
      { type: "achievementEarned", workspace: "T1", member: alice, ladder: "generosity", tier: "silver", at: reaching.at },
    ]);
  });

  test("a kudos after a tier is earned keeps it, with its first date, and earns it no second time", async () => {
    const { t, alice, bob } = await withMembers();
    await count(t, await kudosGiven(t, alice, bob, { kudos: 1, at: now.getTime() }));

    await count(t, await kudosGiven(t, alice, bob, { kudos: 1, at: now.getTime() + minuteMs }));

    expect(earnedIn(await ladderOf(t, alice, "generosity"))).toEqual([{ tier: "bronze", earnedAt: now.getTime() }]);
    expect(earned().filter(({ member, ladder }) => member === alice && ladder === "generosity")).toHaveLength(1);
  });
});

describe("P79: achievementsOf gives the website each ladder's facts", () => {
  test("it returns each ladder in catalogue order with its name, what it counts and its count, every tier in order with its name, threshold, earned time, catalogue version and promised rewards, and the next tier", async () => {
    const { t, alice, bob } = await withMembers();

    await count(t, await kudosGiven(t, alice, bob, { kudos: 3, at: now.getTime() }));

    const unearned = (tier: string, name: string, count: number, rewards: object[]) => ({ tier, name, count, earnedAt: null, catalogueVersion: null, rewards });
    expect(await t.query(internal.achievements.achievements.achievementsOf, { member: bob })).toEqual({
      ladders: [
        {
          ladder: "generosity",
          name: "Generosity",
          counts: "kudos given",
          count: 0,
          tiers: [
            unearned("bronze", "First Thanks", 1, [{ kind: "coins", reward: "generosity-bronze-coins" }]),
            unearned("silver", "Generous Soul", 25, [{ kind: "kudosEmoji", reward: "generosity-silver-kudos-emoji" }]),
            unearned("gold", "Heart of the Team", 100, [{ kind: "hedgehog", reward: "generosity-gold-hedgehog" }]),
            unearned("diamond", "Patron of Praise", 500, [
              { kind: "coins", reward: "generosity-diamond-coins" },
              { kind: "hedgehog", reward: "generosity-diamond-hedgehog" },
            ]),
          ],
          next: "bronze",
        },
        {
          ladder: "recognition",
          name: "Recognition",
          counts: "kudos received",
          count: 3,
          tiers: [
            { tier: "bronze", name: "Noticed", count: 1, earnedAt: now.getTime(), catalogueVersion: "1", rewards: [{ kind: "coins", reward: "recognition-bronze-coins" }] },
            unearned("silver", "Appreciated", 25, [{ kind: "kudosEmoji", reward: "recognition-silver-kudos-emoji" }]),
            unearned("gold", "Highly Valued", 100, [{ kind: "hedgehog", reward: "recognition-gold-hedgehog" }]),
            unearned("diamond", "Hall of Fame", 500, [
              { kind: "coins", reward: "recognition-diamond-coins" },
              { kind: "hedgehog", reward: "recognition-diamond-hedgehog" },
            ]),
          ],
          next: "silver",
        },
        notStarted("connections", "Connections", "different people thanked", [
          ["Friendly Face", 3],
          ["Connector", 6],
          ["Social Butterfly", 12],
          ["Constellation Maker", 24],
        ]),
        notStarted("dependability", "Dependability", "days with a kudos given", [
          ["Regular", 10],
          ["Mainstay", 30],
          ["Pillar", 100],
          ["Cornerstone", 250],
        ]),
        notStarted("applause", "Applause", "days thanking 3+ different people", [
          ["Shout-out", 3],
          ["Hype Squad", 10],
          ["Thunderous Applause", 30],
          ["Grand Chorus", 100],
        ]),
        notStarted("seasons", "Seasons", "calendar months with a kudos given", [
          ["First Chapter", 1],
          ["Season of Thanks", 3],
          ["Half-Year Hero", 6],
          ["Year of Gratitude", 12],
        ]),
      ],
    });
  });

  test("a member past 500 has every tier earned in ladder order and no next tier", async () => {
    const { t, alice, bob } = await withMembers();

    await count(t, await kudosGiven(t, alice, bob, { kudos: 500, at: now.getTime() }));

    const generosity = await ladderOf(t, alice, "generosity");
    expect(earnedIn(generosity).map(({ tier }) => tier)).toEqual(["bronze", "silver", "gold", "diamond"]);
    expect(generosity.next).toBeNull();
  });

  test("before the Book's launch in the workspace, achievementsOf answers null even where it applies", async () => {
    const t = await flagsFromPostHog(testBackend(), postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), offForEveryone("achievements"));
    await unlocksShippedBeforeAnyoneJoined(t);
    await flagsFromPostHog(t, postHog, onForEveryone("xp-levels"), onForEveryone("unlocks"), onForEveryone("achievements"));
    const member = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }));

    expect(await t.query(internal.achievements.achievements.achievementsOf, { member })).toBeNull();
  });

  test("where the Book doesn't apply, achievementsOf answers null", async () => {
    const t = await flagsLoaded(testBackend());
    const member = await t.run((ctx) => ctx.db.insert("members", { workspace: "T1", user: "U_ALICE", kind: "member" }));

    expect(await t.query(internal.achievements.achievements.achievementsOf, { member })).toBeNull();
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

async function ladderOf(t: Backend, member: MemberId, ladder: LadderId) {
  const facts = await t.query(internal.achievements.achievements.achievementsOf, { member });
  return facts!.ladders.find((entry) => entry.ladder === ladder)!;
}

function earnedIn({ tiers }: LadderFacts) {
  return tiers.filter(({ earnedAt }) => earnedAt !== null).map(({ tier, earnedAt }) => ({ tier, earnedAt }));
}

function earned() {
  return vi
    .mocked(publish)
    .mock.calls.map(([, event]) => event)
    .filter((event): event is Extract<DomainEvent, { type: "achievementEarned" }> => event.type === "achievementEarned");
}

function notStarted(ladder: LadderId, name: string, counts: string, tiers: Array<[string, number]>): LadderFacts {
  const [bronze, silver, gold, diamond] = tiers;
  return {
    ladder,
    name,
    counts,
    count: 0,
    tiers: [
      { tier: "bronze", name: bronze![0], count: bronze![1], earnedAt: null, catalogueVersion: null, rewards: [{ kind: "coins", reward: `${ladder}-bronze-coins` }] },
      { tier: "silver", name: silver![0], count: silver![1], earnedAt: null, catalogueVersion: null, rewards: [{ kind: "kudosEmoji", reward: `${ladder}-silver-kudos-emoji` }] },
      { tier: "gold", name: gold![0], count: gold![1], earnedAt: null, catalogueVersion: null, rewards: [{ kind: "hedgehog", reward: `${ladder}-gold-hedgehog` }] },
      {
        tier: "diamond",
        name: diamond![0],
        count: diamond![1],
        earnedAt: null,
        catalogueVersion: null,
        rewards: [
          { kind: "coins", reward: `${ladder}-diamond-coins` },
          { kind: "hedgehog", reward: `${ladder}-diamond-hedgehog` },
        ],
      },
    ],
    next: "bronze",
  };
}
