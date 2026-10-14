import type { ComponentType } from "react";
import type { TierReward } from "../shell";

type RewardLook = { words: (reward: TierReward) => string; Glyph: ComponentType };

const rewardLooks: Record<TierReward["kind"], RewardLook> = {
  coins: { words: ({ coins }) => `${coins} coins`, Glyph: CoinGlyph },
};

export function rewardWords(reward: TierReward) {
  return rewardLooks[reward.kind].words(reward);
}

export function rewardsSaid(rewards: TierReward[]) {
  return listOf(rewards.map(rewardWords));
}

export function listOf(words: string[]) {
  return words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

export function RewardLine({ rewards }: { rewards: TierReward[] }) {
  if (rewards.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
      <span className="sr-only">Reward: </span>
      {rewards.map((reward) => (
        <Reward key={reward.kind} reward={reward} />
      ))}
    </span>
  );
}

export function RewardGains({ rewards, className = "" }: { rewards: TierReward[]; className?: string }) {
  return rewards.map((reward) => <Reward key={reward.kind} reward={reward} sign="+" className={className} />);
}

function Reward({ reward, sign = "", className = "" }: { reward: TierReward; sign?: string; className?: string }) {
  const { Glyph } = rewardLooks[reward.kind];
  return (
    <span data-reward={reward.kind} className={`inline-flex items-center gap-1 ${className}`}>
      <Glyph />
      {sign}
      {rewardWords(reward)}
    </span>
  );
}

function CoinGlyph() {
  return (
    <svg data-glyph="coin" viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 shrink-0">
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <circle cx="8" cy="8" r="4.5" fill="none" stroke="var(--card)" strokeWidth="1.2" />
    </svg>
  );
}
