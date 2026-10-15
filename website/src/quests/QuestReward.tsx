import { rewardCoinsAttributes } from "../crates/RewardFlight";
import type { QuestReward } from "../shell";
import { CoinGlyph } from "../skills/glyphs";
import { coinsText } from "../skills/perkWords";

export function rewardWords({ xp, coins }: QuestReward) {
  return coins === undefined ? `${xp} XP` : `${xp} XP and ${coinsText(coins)}`;
}

export function Coins({ coins, seen = null }: { coins: number; seen?: string | null }) {
  return (
    <span data-reward="coins" className="inline-flex items-center gap-1 align-middle tabular-nums" {...rewardCoinsAttributes(seen)}>
      <CoinGlyph />
      {coins}
      <span className="sr-only">{coins === 1 ? " coin" : " coins"}</span>
    </span>
  );
}

export function CoinsGained({ coins }: { coins: number }) {
  return (
    <span data-reward="coins" className="inline-flex items-center gap-1.5">
      <CoinGlyph className="size-4" />
      {`+${coinsText(coins)}`}
    </span>
  );
}
