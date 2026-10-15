import type { QuestReward } from "../shell";
import { CoinGlyph } from "../skills/glyphs";
import { coinsText } from "../skills/perkWords";

export function rewardWords({ xp, coins }: QuestReward) {
  return coins === undefined ? `${xp} XP` : `${xp} XP and ${coinsText(coins)}`;
}

export function Coins({ coins }: { coins: number }) {
  return (
    <span data-reward="coins" className="inline-flex items-center gap-1 tabular-nums">
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
