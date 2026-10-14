import { levelOf, skillPointsEarnedAt, xpToReach } from "../../../convex/progression/levels";
import type { MemberProfile, Progression } from "../shell";
import type { ReadyCrate } from "./readyCrates";

export type RewardKind = "xp" | "skillPoints";

export type Reward = Record<RewardKind, number>;

export const rewardKinds: RewardKind[] = ["xp", "skillPoints"];

const nothing: Reward = { xp: 0, skillPoints: 0 };

export function rewardOf(crate: ReadyCrate, { progression, skillPoints }: MemberProfile): Reward {
  if (crate.kind === "feature") return { ...nothing, skillPoints: crate.card.feature === "skillTree" ? (skillPoints ?? 0) : 0 };
  if (progression === null || skillPoints === null) return { ...nothing, xp: crate.xp };
  return { xp: crate.xp, skillPoints: Math.min(skillPoints, pointsEarnedBy(progression, crate.xp)) };
}

export function withTheRewardHeld(member: MemberProfile, reward: Reward, held: RewardKind[]): MemberProfile {
  const { progression, skillPoints } = member;
  return {
    ...member,
    progression: held.includes("xp") && progression !== null ? progressionBefore(progression, reward.xp) : progression,
    skillPoints: held.includes("skillPoints") && skillPoints !== null ? skillPoints - reward.skillPoints : skillPoints,
  };
}

function pointsEarnedBy(progression: Progression, reward: number) {
  return skillPointsEarnedAt(progression.level) - skillPointsEarnedAt(progressionBefore(progression, reward).level);
}

function progressionBefore(progression: Progression, reward: number): Progression {
  const xp = Math.max(0, progression.xp - reward);
  if (xp >= progression.levelStartsAt) return { ...progression, xp, xpToNextLevel: progression.nextLevelAt - xp };
  return progressionAt(xp);
}

function progressionAt(xp: number): Progression {
  const level = levelOf(xp);
  const nextLevelAt = xpToReach(level + 1);
  return { level, xp, levelStartsAt: xpToReach(level), nextLevelAt, xpToNextLevel: nextLevelAt - xp };
}
