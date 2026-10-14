import { levelOf, skillPointsEarnedAt, xpToReach } from "../../../convex/progression/levels";
import type { MemberProfile, Progression } from "../shell";
import type { ReadyCrate } from "./readyCrates";

export type RewardKind = "xp" | "skillPoints";

export type Reward = Record<RewardKind, number>;

export type OnTheWay = { crate: ReadyCrate; landed: RewardKind[]; reward?: Reward };

export function rewardsOf(member: MemberProfile, onTheWay: OnTheWay[]): Reward[] {
  let xpLandingLater = 0;
  const xpRewards = [...onTheWay]
    .reverse()
    .map((item) => {
      const reward = item.reward ?? xpRewardOf(item.crate, member, xpLandingLater);
      if (!item.landed.includes("xp")) xpLandingLater += reward.xp;
      return reward;
    })
    .reverse();
  const pointsEarnedOnTheWay = xpRewards.reduce((sum, { skillPoints }, at) => (onTheWay[at]!.crate.kind === "quest" ? sum + skillPoints : sum), 0);
  return onTheWay.map(({ crate, reward }, at) => reward ?? (isTheSkillTree(crate) ? { xp: 0, skillPoints: Math.max(0, (member.skillPoints ?? 0) - pointsEarnedOnTheWay) } : xpRewards[at]!));
}

export function withTheRewardsHeld(member: MemberProfile, onTheWay: OnTheWay[]): MemberProfile {
  if (onTheWay.length === 0) return member;
  const rewards = rewardsOf(member, onTheWay);
  const held = (kind: RewardKind) => onTheWay.reduce((sum, { landed }, at) => (landed.includes(kind) ? sum : sum + rewards[at]![kind]), 0);
  const { progression, skillPoints } = member;
  return {
    ...member,
    progression: progression === null ? null : progressionBefore(progression, held("xp")),
    skillPoints: skillPoints === null ? null : Math.max(0, skillPoints - held("skillPoints")),
  };
}

export function crossesALevel({ xp, nextLevelAt }: Progression, reward: number) {
  return xp + reward >= nextLevelAt;
}

function isTheSkillTree(crate: ReadyCrate) {
  return crate.kind === "feature" && crate.card.feature === "skillTree";
}

function xpRewardOf(crate: ReadyCrate, { progression, skillPoints }: MemberProfile, xpLandingLater: number): Reward {
  if (crate.kind === "feature") return { xp: 0, skillPoints: 0 };
  if (progression === null || skillPoints === null) return { xp: crate.xp, skillPoints: 0 };
  const levelOnceLanded = progressionBefore(progression, xpLandingLater).level;
  const levelBefore = progressionBefore(progression, xpLandingLater + crate.xp).level;
  return { xp: crate.xp, skillPoints: skillPointsEarnedAt(levelOnceLanded) - skillPointsEarnedAt(levelBefore) };
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
