import { levelOf, skillPointsEarnedAt, xpToReach } from "../../../convex/progression/levels";
import type { AppliedReward, MemberProfile, Progression } from "../shell";
import type { ReadyCrate } from "./readyCrates";

export type RewardKind = "xp" | "skillPoints" | "coins";

export type Reward = Record<RewardKind, number>;

export type Climb = AppliedReward | null;

export type OnTheWay = { crate: ReadyCrate; landed: RewardKind[]; reward?: Reward; climb?: Climb };

export function climbRewardOf({ xp, coins, from, to }: AppliedReward): Reward {
  return { xp, skillPoints: Math.max(0, to.skillPoints - from.skillPoints), coins };
}

export function listedRewardOf(crate: ReadyCrate): Reward {
  if (crate.kind === "feature") return { xp: 0, skillPoints: 0, coins: 0 };
  return { xp: crate.reward.xp, skillPoints: 0, coins: crate.reward.coins ?? 0 };
}

function holds({ climb }: OnTheWay) {
  return climb !== null;
}

export function rewardsOf(member: MemberProfile, onTheWay: OnTheWay[]): Reward[] {
  const rewards = heldRewardsOf(member, onTheWay.filter(holds));
  return onTheWay.map((item) => (item.climb === null ? (item.reward ?? listedRewardOf(item.crate)) : rewards.shift()!));
}

function heldRewardsOf(member: MemberProfile, onTheWay: OnTheWay[]): Reward[] {
  let xpLandingLater = 0;
  const xpRewards = [...onTheWay]
    .reverse()
    .map((item) => {
      const reward = item.reward ?? crateRewardOf(item.crate, member, xpLandingLater);
      if (!item.landed.includes("xp")) xpLandingLater += reward.xp;
      return reward;
    })
    .reverse();
  const pointsEarnedOnTheWay = xpRewards.reduce((sum, { skillPoints }, at) => (onTheWay[at]!.crate.kind === "quest" ? sum + skillPoints : sum), 0);
  return onTheWay.map(({ crate, reward }, at) => reward ?? (isTheSkillTree(crate) ? { xp: 0, skillPoints: Math.max(0, (member.skillPoints ?? 0) - pointsEarnedOnTheWay), coins: 0 } : xpRewards[at]!));
}

export function withTheRewardsHeld(member: MemberProfile, onTheWay: OnTheWay[]): MemberProfile {
  const holding = onTheWay.filter(holds);
  if (holding.length === 0) return member;
  const rewards = heldRewardsOf(member, holding);
  const held = (kind: RewardKind) => holding.reduce((sum, { landed }, at) => (landed.includes(kind) ? sum : sum + rewards[at]![kind]), 0);
  const pinned = (kind: RewardKind) => {
    const first = holding.find(({ landed }) => !landed.includes(kind)) ?? holding.at(-1);
    return first?.climb?.[first.landed.includes(kind) ? "to" : "from"][kind];
  };
  const { progression, skillPoints, coins } = member;
  const pinnedXp = pinned("xp");
  return {
    ...member,
    progression: progression === null ? null : pinnedXp === undefined ? progressionBefore(progression, held("xp")) : progressionAt(pinnedXp),
    skillPoints: skillPoints === null ? null : (pinned("skillPoints") ?? Math.max(0, skillPoints - held("skillPoints"))),
    coins: coins === null ? null : (pinned("coins") ?? Math.max(0, coins - held("coins"))),
  };
}

export function crossesALevel({ xp, nextLevelAt }: Progression, reward: number) {
  return xp + reward >= nextLevelAt;
}

function isTheSkillTree(crate: ReadyCrate) {
  return crate.kind === "feature" && crate.card.feature === "skillTree";
}

function crateRewardOf(crate: ReadyCrate, { progression, skillPoints }: MemberProfile, xpLandingLater: number): Reward {
  if (crate.kind === "feature") return { xp: 0, skillPoints: 0, coins: 0 };
  const { xp, coins = 0 } = crate.reward;
  if (progression === null || skillPoints === null) return { xp, skillPoints: 0, coins };
  const levelOnceLanded = progressionBefore(progression, xpLandingLater).level;
  const levelBefore = progressionBefore(progression, xpLandingLater + xp).level;
  return { xp, skillPoints: skillPointsEarnedAt(levelOnceLanded) - skillPointsEarnedAt(levelBefore), coins };
}

function progressionBefore(progression: Progression, reward: number): Progression {
  const xp = Math.max(0, progression.xp - reward);
  if (xp >= progression.levelStartsAt) return { ...progression, xp, xpToNextLevel: progression.nextLevelAt - xp };
  return progressionAt(xp);
}

export function progressionAt(xp: number): Progression {
  const level = levelOf(xp);
  const nextLevelAt = xpToReach(level + 1);
  return { level, xp, levelStartsAt: xpToReach(level), nextLevelAt, xpToNextLevel: nextLevelAt - xp };
}
