import type { QuestReward } from "../shell";
import { CoinGlyph } from "../skills/glyphs";
import { coinsText } from "../skills/perkWords";

export function xpLineOf({ xp }: QuestReward, waiting: boolean) {
  return waiting ? `+${xp} XP waiting` : `+${xp} XP`;
}

export function rewardWords({ xp, coins }: QuestReward): string | undefined {
  const paid = [...(xp > 0 ? [`${xp} XP`] : []), ...(coins === undefined ? [] : [coinsText(coins)])];
  return paid.length === 0 ? undefined : paid.join(" and ");
}

export function earnedLineOf(reward: QuestReward) {
  const words = rewardWords(reward);
  return words === undefined ? "Reward claimed" : `You earned ${words}`;
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
