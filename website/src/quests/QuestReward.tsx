import type { QuestReward } from "../shell";
import { CoinGlyph } from "../skills/glyphs";
import { coinsText } from "../skills/perkWords";

export function xpLineOf({ xp }: QuestReward, waiting: boolean) {
  return waiting ? `+${xp} XP waiting` : `+${xp} XP`;
}

export function rewardWords({ xp, coins }: QuestReward) {
  return coins === undefined ? `${xp} XP` : `${xp} XP and ${coinsText(coins)}`;
}

export function Coins({ coins }: { coins: number }) {
  return (
    <span data-reward="coins" className="inline-flex items-center gap-1 align-middle tabular-nums">
      <CoinGlyph />
      {coins}
      <span className="sr-only">{coins === 1 ? " coin" : " coins"}</span>
    </span>
  );
}
