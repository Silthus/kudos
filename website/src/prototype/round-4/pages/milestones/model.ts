// PROTOTYPE (#625, round 4): what the milestones layouts read from the album's milestones. Never merge to main.
import type { Milestone, MilestoneTier } from "../../../round-3/album";

export type TierId = MilestoneTier["tier"];

export type EarnedTier = MilestoneTier & { earnedAt: number };

export type Earned = { milestone: Milestone; tier: EarnedTier };

export type NextUp = { milestone: Milestone; tier: MilestoneTier; toGo: number; share: number };

export const tierWords: Record<TierId, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", diamond: "Diamond" };

export const tierOrder: readonly TierId[] = ["bronze", "silver", "gold", "diamond"];

export function isEarned(tier: MilestoneTier): tier is EarnedTier {
  return tier.earnedAt !== null;
}

export function keyOf(milestone: Milestone, tier: MilestoneTier) {
  return `${milestone.id}:${tier.tier}`;
}

export function bestOf(milestone: Milestone) {
  return milestone.tiers.findLast(isEarned) ?? null;
}

export function nextOf(milestone: Milestone) {
  return milestone.tiers.find((tier) => !isEarned(tier)) ?? null;
}

export function nextUpOf(milestone: Milestone): NextUp | null {
  const tier = nextOf(milestone);
  if (tier === null) return null;
  return { milestone, tier, toGo: Math.max(0, tier.at - milestone.count), share: Math.min(1, milestone.count / tier.at) };
}

export function nextUps(milestones: readonly Milestone[]) {
  return milestones.flatMap((milestone) => nextUpOf(milestone) ?? []).toSorted((first, second) => second.share - first.share || first.toGo - second.toGo);
}

export function closestNextOf(milestones: readonly Milestone[]) {
  return nextUps(milestones)[0] ?? null;
}

export function tiersEarned(milestones: readonly Milestone[]) {
  const tiers = milestones.flatMap(({ tiers }) => tiers);
  return { earned: tiers.filter(isEarned).length, total: tiers.length };
}

export function earnedNewestFirst(milestones: readonly Milestone[]): Earned[] {
  return milestones
    .flatMap((milestone) => milestone.tiers.filter(isEarned).map((tier) => ({ milestone, tier })))
    .toSorted((first, second) => second.tier.earnedAt - first.tier.earnedAt || tierOrder.indexOf(second.tier.tier) - tierOrder.indexOf(first.tier.tier));
}

export function progressWords(milestone: Milestone, tier: MilestoneTier) {
  return `${Math.min(milestone.count, tier.at)} of ${tier.at} ${milestone.counts}`;
}

export function toGoWords({ toGo, tier }: NextUp) {
  return `${toGo} to go for ${tier.name}`;
}

export function countWords(milestone: Milestone) {
  return `${milestone.count} ${milestone.counts}`;
}

export function dateWords(at: number) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(at));
}

export function dayWords(at: number) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date(at));
}

export function earnedSentence({ milestone, tier }: Earned) {
  return `${tier.at} ${milestone.counts}.`;
}
