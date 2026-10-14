import { v, type Infer } from "convex/values";

export const ladderValidator = v.union(v.literal("generosity"), v.literal("recognition"), v.literal("old-friends"));

export const tierValidator = v.union(v.literal("bronze"), v.literal("silver"), v.literal("gold"), v.literal("diamond"));

export const rewardKindValidator = v.union(v.literal("coins"), v.literal("kudosEmoji"), v.literal("hedgehog"));

export const promisedRewardValidator = v.object({ kind: rewardKindValidator, reward: v.string() });

export type LadderId = Infer<typeof ladderValidator>;

export type TierId = Infer<typeof tierValidator>;

export type PromisedReward = Infer<typeof promisedRewardValidator>;

export type Tier = { tier: TierId; name: string; count: number; rewards: PromisedReward[] };

export type Ladder = { ladder: LadderId; name: string; counts: string; tiers: Tier[] };

type FourTiers<T> = [T, T, T, T];

const kudosCounts: FourTiers<number> = [1, 25, 100, 500];

export const ladders = {
  version: "1",
  ladders: [
    {
      ladder: "generosity",
      name: "Generosity",
      counts: "kudos given",
      tiers: tiersOf("generosity", ["First Thanks", "Generous Soul", "Heart of the Team", "Patron of Praise"], kudosCounts),
    },
    {
      ladder: "recognition",
      name: "Recognition",
      counts: "kudos received",
      tiers: tiersOf("recognition", ["Noticed", "Appreciated", "Highly Valued", "Hall of Fame"], kudosCounts),
    },
    {
      ladder: "old-friends",
      name: "Old Friends",
      counts: "thanks again after 30+ days",
      tiers: tiersOf("old-friends", ["Remembered", "Old Friends", "Long Memory", "Evergreen"], [1, 3, 6, 12]),
    },
  ],
} as const satisfies { version: string; ladders: readonly Ladder[] };

export function ladderOf(ladder: LadderId): Ladder {
  return ladders.ladders.find((entry) => entry.ladder === ladder)!;
}

function tiersOf(ladder: LadderId, [bronze, silver, gold, diamond]: FourTiers<string>, counts: FourTiers<number>): Tier[] {
  return [
    { tier: "bronze", name: bronze, count: counts[0], rewards: [{ kind: "coins", reward: `${ladder}-bronze-coins` }] },
    { tier: "silver", name: silver, count: counts[1], rewards: [{ kind: "kudosEmoji", reward: `${ladder}-silver-kudos-emoji` }] },
    { tier: "gold", name: gold, count: counts[2], rewards: [{ kind: "hedgehog", reward: `${ladder}-gold-hedgehog` }] },
    {
      tier: "diamond",
      name: diamond,
      count: counts[3],
      rewards: [
        { kind: "coins", reward: `${ladder}-diamond-coins` },
        { kind: "hedgehog", reward: `${ladder}-diamond-hedgehog` },
      ],
    },
  ];
}
