import type { LadderCard, TierCard } from "../shell";

export type EarnedTier = TierCard & { earnedAt: number };

export type Shelved = { ladder: LadderCard; tier: EarnedTier };

export type ClosestNext = { ladder: LadderCard; tier: TierCard; toGo: number };

const week = 7 * 24 * 60 * 60 * 1000;

export function isEarned(tier: TierCard): tier is EarnedTier {
  return tier.earnedAt !== null;
}

export function bestOf(ladder: LadderCard) {
  return ladder.tiers.findLast(isEarned) ?? null;
}

export function tiersEarned(ladders: readonly LadderCard[]) {
  return {
    earned: ladders.reduce((sum, { tiers }) => sum + tiers.filter(isEarned).length, 0),
    total: ladders.reduce((sum, { tiers }) => sum + tiers.length, 0),
  };
}

export function closestNextOf(ladders: readonly LadderCard[]): ClosestNext | null {
  let closest: ClosestNext | null = null;
  for (const ladder of ladders) {
    const tier = ladder.tiers.find(({ tier }) => tier === ladder.next?.tier);
    if (ladder.next === null || tier === undefined) continue;
    const toGo = ladder.next.at - ladder.count;
    if (closest === null || toGo < closest.toGo) closest = { ladder, tier, toGo };
  }
  return closest;
}

export function recentlyEarned(ladders: readonly LadderCard[]): Shelved[] {
  return ladders
    .flatMap((ladder) => {
      const tier = bestOf(ladder);
      return tier === null ? [] : [{ ladder, tier }];
    })
    .sort((a, b) => b.tier.earnedAt - a.tier.earnedAt);
}

export function newestEarned(ladders: readonly LadderCard[]): Shelved[] {
  const earned = ladders.flatMap((ladder) => ladder.tiers.filter(isEarned).map((tier) => ({ ladder, tier })));
  const newest = Math.max(...earned.map(({ tier }) => tier.earnedAt));
  return earned.filter(({ tier }) => tier.earnedAt === newest);
}

export function isNew({ tier }: Shelved, now: number) {
  return now - tier.earnedAt < week;
}
