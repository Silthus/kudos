import { describe, expect, test } from "vitest";
import { joinsAllowed, nextTier, promptText, TIER_RARITY, tierRewards, WINDOW_MS } from "./sprees";

describe("kudos spree rules (#55 §G6)", () => {
  test("tiers are 5, 10, 20, 50 and 100 distinct joiners; nothing beyond 100", () => {
    expect([0, 1, 2, 3, 4, 5].map(nextTier)).toEqual([5, 10, 20, 50, 100, null]);
    expect(WINDOW_MS).toBe(24 * 3_600_000);
  });

  test("the receivers' message floor rises by tier: T1 Uncommon … T5 Legendary", () => {
    expect(TIER_RARITY).toEqual(["uncommon", "rare", "epic", "epic", "legendary"]);
  });

  test("everyone gets 5 joins a month; Wanderer adds 2 and each bought join 1", () => {
    expect(joinsAllowed({ wanderer: false, bought: 0 })).toBe(5);
    expect(joinsAllowed({ wanderer: true, bought: 0 })).toBe(7);
    expect(joinsAllowed({ wanderer: true, bought: 3 })).toBe(10);
  });

  test("the prompt says what a join costs and how far the spree is (the spec's example)", () => {
    expect(promptText({ giver: "Ana", receivers: ["Ben"], unit: "kudos", joinsLeft: 4, joiners: 2, next: 5 })).toBe(
      "Join Ana's kudos for Ben? Uses 1 kudos today + 1 of your 4 spree joins this month · 2/5 joined",
    );
    expect(promptText({ giver: "Ana", receivers: ["Ben", "Cleo"], unit: "tacos", joinsLeft: 1, joiners: 7, next: 10 })).toBe(
      "Join Ana's kudos for Ben and Cleo? Uses 2 tacos today + your last spree join this month · 7/10 joined",
    );
  });

  test("a tier pays its joiners 1 coin + 10 XP, earlier joiners +1 coin + 5 XP, the giver +5 coins + 20 XP, receivers 5 XP once", () => {
    expect(tierRewards({ paidNow: ["d", "e"], earlier: ["a"], giver: "g", receivers: ["r1", "r2"] })).toEqual([
      { memberId: "d", role: "joined", xp: 10, coins: 1 },
      { memberId: "e", role: "joined", xp: 10, coins: 1 },
      { memberId: "a", role: "joined", xp: 5, coins: 1 },
      { memberId: "g", role: "started", xp: 20, coins: 5 },
      { memberId: "r1", role: "received", xp: 5, coins: 0 },
      { memberId: "r2", role: "received", xp: 5, coins: 0 },
    ]);
  });
});
