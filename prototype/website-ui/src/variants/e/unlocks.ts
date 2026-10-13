// Variant E progressive unlocks: which level opens each part of HedgeHug, and a preview level to see the site as a newer member would.
import { useSyncExternalStore } from "react";
import { me } from "../../data/mock";

export type Feature = "book" | "gear" | "skills" | "coins" | "collection";

export type Unlock = { feature: Feature; level: number; name: string; teaser: string; how: string };

export const unlocks: Unlock[] = [
  { feature: "book", level: 2, name: "The Book", teaser: "Sticker albums for every team, and your achievements.", how: "Every teammate who thanks you becomes a sticker." },
  { feature: "gear", level: 3, name: "Character and inventory", teaser: "Equip a title, quips and extra kudos emoji.", how: "Things you earn before then wait for you here." },
  { feature: "skills", level: 4, name: "Skill tree", teaser: "Spend skill points on perks that make every thank-you count for more.", how: "Every level from 2 gives a skill point. They wait for you until then." },
  { feature: "coins", level: 5, name: "Coins", teaser: "Coins buy hedgehogs and perk upgrades.", how: "A thoughtful kudos, one that says why in at least five words, can earn coins." },
  { feature: "collection", level: 5, name: "Hedgehog collection", teaser: "Collect hedgehogs and pick one as your avatar.", how: "Find them, earn them, or buy them with coins." },
];

export const unlockOf = (feature: Feature) => unlocks.find((u) => u.feature === feature)!;

export const unlockedAt = (feature: Feature, level: number) => level >= unlockOf(feature).level;

const initialLevel = () => {
  const fromUrl = Number(new URLSearchParams(location.search).get("lvl"));
  return Number.isInteger(fromUrl) && fromUrl >= 1 ? fromUrl : me.level;
};

let previewLevel = initialLevel();
const listeners = new Set<() => void>();

export function setPreviewLevel(level: number) {
  previewLevel = Math.max(1, level);
  const url = new URL(location.href);
  if (previewLevel === me.level) url.searchParams.delete("lvl");
  else url.searchParams.set("lvl", String(previewLevel));
  history.replaceState(null, "", url);
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function usePreviewLevel() {
  return useSyncExternalStore(subscribe, () => previewLevel);
}

export function useUnlocked(feature: Feature) {
  return unlockedAt(feature, usePreviewLevel());
}
