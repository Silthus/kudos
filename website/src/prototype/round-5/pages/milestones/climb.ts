// PROTOTYPE (#625, round 6): how far along its four tiers each milestone has climbed, read left to right. Never merge to main.
import type { Milestone, MilestoneTier } from "../../../round-3/album";
import { isEarned, nextUpOf, tierWords, type NextUp } from "../../../round-4/pages/milestones/model";

export type Step = "earned" | "next" | "later";

export function stepOf(milestone: Milestone, tier: MilestoneTier): Step {
  if (isEarned(tier)) return "earned";
  return nextUpOf(milestone)?.tier.tier === tier.tier ? "next" : "later";
}

export function climbedShare(milestone: Milestone) {
  const reached = milestone.tiers.findLastIndex(isEarned);
  if (reached < 0) return 0;
  const from = milestone.tiers[reached]!;
  const to = milestone.tiers[reached + 1];
  if (to === undefined) return 1;
  const between = Math.min(1, Math.max(0, (milestone.count - from.at) / (to.at - from.at)));
  return (reached + between) / (milestone.tiers.length - 1);
}

export function goalWords(next: NextUp) {
  return `${next.toGo} to go for ${next.tier.name}`;
}

export function goalLabel(next: NextUp) {
  return `${tierWords[next.tier.tier]} · ${next.milestone.name}`;
}
