import type { Rarity } from "../../../convex/hoggies/catalogue";
import type { CompletedCrest, CrestArt, Drop, HoggieArt } from "../../../convex/hoggies/drops";

export type { CompletedCrest, CrestArt, Drop, HoggieArt, Rarity };

const rarityMarks: Record<Rarity, string> = { common: "⬜", uncommon: "🟩", rare: "🟦", epic: "🟪", legendary: "🟧" };

export function rarityMarkOf(rarity: Rarity) {
  return rarityMarks[rarity];
}

export function rarityWordsOf(rarity: Rarity) {
  return `${rarityMarks[rarity]} ${rarity.charAt(0).toUpperCase()}${rarity.slice(1)}`;
}

export function copyWordsOf({ copy, isNew }: Drop) {
  return isNew ? "New!" : `×${copy}`;
}

export function dropLineOf(drop: Drop) {
  return `${drop.name} · ${rarityWordsOf(drop.rarity)} · ${copyWordsOf(drop)}`;
}

export function dropOf(answer: { drop?: Drop | null }): Drop | null {
  return answer.drop ?? null;
}
