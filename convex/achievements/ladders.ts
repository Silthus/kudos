import { v, type Infer } from "convex/values";

export const ladderValidator = v.union(
  v.literal("generosity"),
  v.literal("recognition"),
  v.literal("connections"),
  v.literal("dependability"),
  v.literal("applause"),
  v.literal("seasons"),
);

export const tierValidator = v.union(v.literal("bronze"), v.literal("silver"), v.literal("gold"), v.literal("diamond"));

export const rewardKindValidator = v.union(v.literal("coins"), v.literal("kudosEmoji"), v.literal("hedgehog"));

export const promisedRewardValidator = v.object({ kind: rewardKindValidator, reward: v.string() });

export type LadderId = Infer<typeof ladderValidator>;

export type TierId = Infer<typeof tierValidator>;

export type PromisedReward = Infer<typeof promisedRewardValidator>;

export type Tier = { tier: TierId; name: string; count: number; rewards: PromisedReward[] };

export type Ladder = { ladder: LadderId; name: string; counts: string; countsOne: string; tiers: Tier[] };

export const ladders = {
  version: "1",
  ladders: [
    {
      ladder: "generosity",
      name: "Generosity",
      counts: "kudos given",
      countsOne: "kudos given",
      tiers: tiersOf("generosity", [
        ["First Thanks", 1],
        ["Generous Soul", 25],
        ["Heart of the Team", 100],
        ["Patron of Praise", 500],
      ]),
    },
    {
      ladder: "recognition",
      name: "Recognition",
      counts: "kudos received",
      countsOne: "kudos received",
      tiers: tiersOf("recognition", [
        ["Noticed", 1],
        ["Appreciated", 25],
        ["Highly Valued", 100],
        ["Hall of Fame", 500],
      ]),
    },
    {
      ladder: "connections",
      name: "Connections",
      counts: "different people thanked",
      countsOne: "person thanked",
      tiers: tiersOf("connections", [
        ["Friendly Face", 3],
        ["Connector", 6],
        ["Social Butterfly", 12],
        ["Constellation Maker", 24],
      ]),
    },
    {
      ladder: "dependability",
      name: "Dependability",
      counts: "days with a kudos given",
      countsOne: "day with a kudos given",
      tiers: tiersOf("dependability", [
        ["Regular", 10],
        ["Mainstay", 30],
        ["Pillar", 100],
        ["Cornerstone", 250],
      ]),
    },
    {
      ladder: "applause",
      name: "Applause",
      counts: "days thanking 3+ different people",
      countsOne: "day thanking 3+ different people",
      tiers: tiersOf("applause", [
        ["Shout-out", 3],
        ["Hype Squad", 10],
        ["Thunderous Applause", 30],
        ["Grand Chorus", 100],
      ]),
    },
    {
      ladder: "seasons",
      name: "Seasons",
      counts: "calendar months with a kudos given",
      countsOne: "calendar month with a kudos given",
      tiers: tiersOf("seasons", [
        ["First Chapter", 1],
        ["Season of Thanks", 3],
        ["Half-Year Hero", 6],
        ["Year of Gratitude", 12],
      ]),
    },
  ],
} as const satisfies { version: string; ladders: readonly Ladder[] };

export function ladderOf(ladder: LadderId): Ladder {
  return ladders.ladders.find((entry) => entry.ladder === ladder)!;
}

type TierNaming = [name: string, count: number];

export function countsOf(ladder: LadderId, count: number): string {
  const { counts, countsOne } = ladderOf(ladder);
  return count === 1 ? countsOne : counts;
}

function tiersOf(ladder: LadderId, [[bronze, atBronze], [silver, atSilver], [gold, atGold], [diamond, atDiamond]]: [TierNaming, TierNaming, TierNaming, TierNaming]): Tier[] {
  return [
    { tier: "bronze", name: bronze, count: atBronze, rewards: [{ kind: "coins", reward: `${ladder}-bronze-coins` }] },
    { tier: "silver", name: silver, count: atSilver, rewards: [{ kind: "kudosEmoji", reward: `${ladder}-silver-kudos-emoji` }] },
    { tier: "gold", name: gold, count: atGold, rewards: [{ kind: "hedgehog", reward: `${ladder}-gold-hedgehog` }] },
    {
      tier: "diamond",
      name: diamond,
      count: atDiamond,
      rewards: [
        { kind: "coins", reward: `${ladder}-diamond-coins` },
        { kind: "hedgehog", reward: `${ladder}-diamond-hedgehog` },
      ],
    },
  ];
}
