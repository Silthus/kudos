export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type DropArt = { kind: "hoggie"; slug: string };

export type CrestArt = { kind: "crest"; slug: string };

export type Crest = { crest: string; name: string; art: CrestArt };

export type Drop = { hoggie: string; name: string; rarity: Rarity; art: DropArt; copy: number; isNew: boolean; crest?: Crest | null };

export type WithADrop = { drop?: Drop | null };

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

export function dropOf(answer: WithADrop): Drop | null {
  return answer.drop ?? null;
}
