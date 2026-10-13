// Variant E rarity: the item's name in its rarity colour, like a WoW tooltip, with the rarity word on hover.
import type { ReactNode } from "react";
import type { Rarity as RarityKind } from "../../data/types";
import { rarityLabels } from "../../ui";

const nameColour: Record<RarityKind, string> = {
  common: "text-rt-common",
  uncommon: "text-rt-uncommon",
  rare: "text-rt-rare",
  epic: "text-rt-epic",
  legendary: "text-rt-legendary",
};

export function RarityName({ rarity, children, className = "" }: { rarity: RarityKind; children: ReactNode; className?: string }) {
  return (
    <span className={`font-semibold ${nameColour[rarity]} ${className}`} title={rarityLabels[rarity]}>
      {children}
    </span>
  );
}
