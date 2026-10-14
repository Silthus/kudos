import { v, type Infer } from "convex/values";

export const ladderValidator = v.union(v.literal("generosity"), v.literal("recognition"));

export const tierValidator = v.union(v.literal("bronze"), v.literal("silver"), v.literal("gold"), v.literal("diamond"));

export const rewardKindValidator = v.union(v.literal("coins"), v.literal("kudosEmoji"), v.literal("hedgehog"));

export const promisedRewardValidator = v.object({ kind: rewardKindValidator, reward: v.string() });

export type LadderId = Infer<typeof ladderValidator>;

export type TierId = Infer<typeof tierValidator>;

export type PromisedReward = Infer<typeof promisedRewardValidator>;

export type Tier = { tier: TierId; name: string; count: number; rewards: PromisedReward[] };

export type Ladder = { ladder: LadderId; name: string; counts: string; tiers: Tier[] };

export const ladders = {
  version: "1",
  ladders: [
    {
      ladder: "generosity",
      name: "Generosity",
      counts: "kudos given",
      tiers: tiersOf("generosity", ["First Thanks", "Generous Soul", "Heart of the Team", "Patron of Praise"]),
    },
    {
      ladder: "recognition",
      name: "Recognition",
      counts: "kudos received",
      tiers: tiersOf("recognition", ["Noticed", "Appreciated", "Highly Valued", "Hall of Fame"]),
    },
  ],
} as const satisfies { version: string; ladders: readonly Ladder[] };

export function ladderOf(ladder: LadderId): Ladder {
  return ladders.ladders.find((entry) => entry.ladder === ladder)!;
}

function tiersOf(ladder: LadderId, [bronze, silver, gold, diamond]: [string, string, string, string]): Tier[] {
  return [
    { tier: "bronze", name: bronze, count: 1, rewards: [{ kind: "coins", reward: `${ladder}-bronze-coins` }] },
    { tier: "silver", name: silver, count: 25, rewards: [{ kind: "kudosEmoji", reward: `${ladder}-silver-kudos-emoji` }] },
    { tier: "gold", name: gold, count: 100, rewards: [{ kind: "hedgehog", reward: `${ladder}-gold-hedgehog` }] },
    {
      tier: "diamond",
      name: diamond,
      count: 500,
      rewards: [
        { kind: "coins", reward: `${ladder}-diamond-coins` },
        { kind: "hedgehog", reward: `${ladder}-diamond-hedgehog` },
      ],
    },
  ];
}
