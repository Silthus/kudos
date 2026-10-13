import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import type { KudosGivenEvent } from "../bus/events";
import type { Annotations } from "../engine/messageEvent";
import { catalogue } from "./catalogue";
import { progress, standing, type MemberProgress } from "./progress";

const alice = "alice" as Id<"members">;
const bob = "bob" as Id<"members">;
const carol = "carol" as Id<"members">;

describe("P1: base XP", () => {
  test.each([
    ["the giver of one kudos", alice, [[bob, 1]], [10]],
    ["the giver of three kudos to one recipient", alice, [[bob, 3]], [30]],
    ["the giver of two kudos to each of two recipients", alice, [[bob, 2], [carol, 2]], [20, 20]],
    ["a recipient of one kudos", bob, [[bob, 1]], [5]],
    ["a recipient of three kudos", bob, [[bob, 3]], [15]],
    ["a recipient among two", carol, [[bob, 2], [carol, 2]], [10]],
  ] as const)("%s", (_, member, awards, baseXp) => {
    const { effects } = progress(starting(member), kudosGiven(awards), catalogue);

    expect(effects.map((record) => record.baseXp)).toEqual(baseXp);
  });

  test("a member the event doesn't name gets no record", () => {
    const { effects, state } = progress(starting(carol), kudosGiven([[bob, 1]]), catalogue);

    expect(effects).toEqual([]);
    expect(state.xp).toBe(0);
  });
});

describe("P7: an effects record per side of every award", () => {
  test("keyed by award and side, with the day, the gate decision and the catalogue version", () => {
    const event = kudosGiven([[bob, 1], [carol, 1]], { gate: { version: 1, thoughtful: true, words: 6 } });

    const { effects } = progress(starting(alice), event, catalogue);

    expect(effects).toEqual([
      { award: "award-bob", side: "giver", member: alice, day: "2026-10-13", baseXp: 10, gate: { version: 1, thoughtful: true }, catalogueVersion: "1" },
      { award: "award-carol", side: "giver", member: alice, day: "2026-10-13", baseXp: 10, gate: { version: 1, thoughtful: true }, catalogueVersion: "1" },
    ]);
  });

  test("a message without a gate annotation records no gate decision", () => {
    const { effects } = progress(starting(bob), kudosGiven([[bob, 1]], {}), catalogue);

    expect(effects).toEqual([expect.objectContaining({ side: "recipient", baseXp: 5, gate: null })]);
  });
});

test.each([
  ["thoughtful", true],
  ["not thoughtful", false],
])("P13: base XP is the same for a %s kudos", (_, thoughtful) => {
  const event = kudosGiven([[bob, 2]], { gate: { version: 1, thoughtful, words: thoughtful ? 5 : 4 } });

  expect(progress(starting(alice), event, catalogue).state.xp).toBe(20);
  expect(progress(starting(bob), event, catalogue).state.xp).toBe(10);
});

describe("P3 P4 P6 P63: levels, skill points and what the level-up DM needs", () => {
  test.each([
    [0, 0, 1, []],
    [10, 10, 1, []],
    [10, 20, 2, [{ level: 2, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 80 }]],
    [90, 100, 3, [{ level: 3, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 200 }]],
    [290, 300, 4, [{ level: 4, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 300 }]],
    [590, 600, 5, [{ level: 5, skillPointsGained: 1, skillPoints: 1, xpToNextLevel: 400 }]],
    [3590, 3600, 10, [{ level: 10, skillPointsGained: 1, skillPoints: 6, xpToNextLevel: 900 }]],
    [17090, 17100, 20, [{ level: 20, skillPointsGained: 1, skillPoints: 16, xpToNextLevel: 1900 }]],
    [0, 100, 3, [{ level: 3, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 200 }]],
    [10, 310, 4, [{ level: 4, skillPointsGained: 0, skillPoints: 0, xpToNextLevel: 290 }]],
    [290, 600, 5, [{ level: 5, skillPointsGained: 1, skillPoints: 1, xpToNextLevel: 400 }]],
    [100, 1000, 6, [{ level: 6, skillPointsGained: 2, skillPoints: 2, xpToNextLevel: 500 }]],
  ])("from %i XP to %i XP reaches level %i", (xpBefore, xpAfter, level, reached) => {
    const kudos = (xpAfter - xpBefore) / 10;
    const event = kudosGiven([[bob, kudos]]);

    const { state, events } = progress({ member: alice, xp: xpBefore, pointsSpent: 0 }, event, catalogue);

    expect(state.xp).toBe(xpAfter);
    expect(events).toEqual(
      reached.map((levelReached) => ({ type: "levelReached", workspace: "T1", member: alice, ...levelReached, message: event.message, at: event.at })),
    );
  });
});

test.each([
  [0, 0, { xp: 0, level: 1, skillPoints: 0 }],
  [20, 0, { xp: 20, level: 2, skillPoints: 0 }],
  [300, 0, { xp: 300, level: 4, skillPoints: 0 }],
  [600, 0, { xp: 600, level: 5, skillPoints: 1 }],
  [1500, 0, { xp: 1500, level: 7, skillPoints: 3 }],
  [3600, 0, { xp: 3600, level: 10, skillPoints: 6 }],
  [3600, 4, { xp: 3600, level: 10, skillPoints: 2 }],
])("P4: at %i XP with %i points spent, a member stands at %o", (xp, pointsSpent, expected) => {
  expect(standing({ member: alice, xp, pointsSpent })).toEqual(expected);
});

function starting(member: Id<"members">): MemberProgress {
  return { member, xp: 0, pointsSpent: 0 };
}

function kudosGiven(awards: ReadonlyArray<readonly [Id<"members">, number]>, annotations: Annotations = {}): KudosGivenEvent {
  return {
    type: "kudosGiven",
    workspace: "T1",
    message: { workspace: "T1", conversation: "C1", message: "1" },
    giver: alice,
    awards: awards.map(([recipient, kudos]) => ({ award: `award-${recipient}` as Id<"awards">, giver: alice, recipient, kudos })),
    via: "message",
    kudosEmoji: "taco",
    annotations,
    allowance: { dailyOpening: 3, dailyLeft: 0 },
    day: "2026-10-13",
    at: Date.parse("2026-10-13T10:00:00Z"),
  };
}
