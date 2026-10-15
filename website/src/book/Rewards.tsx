import type { ReactNode } from "react";
import type { TierReward } from "../shell";

type RewardLook = { words: string; gained: string; owned: string; plural: boolean; glyph: ReactNode };

function lookOf(reward: TierReward): RewardLook {
  switch (reward.kind) {
    case "coins":
      return { words: `${reward.coins} coins`, gained: `+${reward.coins} coins`, owned: `${reward.coins} coins`, plural: true, glyph: <CoinGlyph /> };
    case "kudosEmoji":
      return { words: `${reward.name} emoji`, gained: `${reward.name} emoji`, owned: `the ${reward.name} emoji`, plural: false, glyph: <ArtGlyph art={reward.art} /> };
  }
}

export function rewardsSaid(rewards: TierReward[]) {
  return listOf(rewards.map((reward) => lookOf(reward).owned));
}

export function rewardsAreYours(rewards: TierReward[]) {
  const said = rewardsSaid(rewards);
  const plural = rewards.length > 1 || rewards.some((reward) => lookOf(reward).plural);
  return `${said.charAt(0).toUpperCase()}${said.slice(1)} ${plural ? "are" : "is"} yours.`;
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
        <Reward key={reward.kind} reward={reward} said="words" />
      ))}
    </span>
  );
}

export function RewardGains({ rewards, className = "" }: { rewards: TierReward[]; className?: string }) {
  return rewards.map((reward) => <Reward key={reward.kind} reward={reward} said="gained" className={className} />);
}

function Reward({ reward, said, className = "" }: { reward: TierReward; said: "words" | "gained"; className?: string }) {
  const look = lookOf(reward);
  return (
    <span data-reward={reward.kind} className={`inline-flex items-center gap-1 ${className}`}>
      {look.glyph}
      {look[said]}
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

function ArtGlyph({ art }: { art: Extract<TierReward, { kind: "kudosEmoji" }>["art"] }) {
  if (art.kind !== "unicode") return null;
  return (
    <span data-glyph="emoji" aria-hidden="true" className="text-sm leading-none">
      {art.glyph}
    </span>
  );
}
