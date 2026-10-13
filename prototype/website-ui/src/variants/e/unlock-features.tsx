// Variant E unlock presentation: each feature's icon, hedgehog and destination, and the level arithmetic every locked surface shares.
import type { ComponentType } from "react";
import { HedgehogExplorer, HedgehogMoney, HedgehogReading, HedgehogSuperhero, HedgehogWizard } from "@posthog/brand/hoggies";
import { IconBook, IconBox, IconListTree, IconPalette } from "@posthog/icons";
import type { ScreenId } from "../../nav";
import { CoinGlyph } from "./hud";
import { unlockOf, unlocks, type Feature, type Unlock } from "./unlocks";

type IconArt = ComponentType<{ className?: string }>;
type HogArt = ComponentType<{ size?: number; className?: string; title?: string }>;

export type FeatureLook = { Icon: IconArt; Hog: HogArt; screen: ScreenId; param?: string };

export const featureLook: Record<Feature, FeatureLook> = {
  book: { Icon: IconBook, Hog: HedgehogReading, screen: "stickers" },
  gear: { Icon: IconBox, Hog: HedgehogSuperhero, screen: "profile", param: "inventory" },
  skills: { Icon: IconListTree, Hog: HedgehogWizard, screen: "skills" },
  coins: { Icon: CoinGlyph, Hog: HedgehogMoney, screen: "collection" },
  collection: { Icon: IconPalette, Hog: HedgehogExplorer, screen: "collection" },
};

export const screenFeature: Partial<Record<ScreenId, Feature>> = {
  skills: "skills",
  stickers: "book",
  achievements: "book",
  collection: "collection",
};

export const isFeature = (value?: string): value is Feature => unlocks.some((u) => u.feature === value);

export const unlocksAtLevel = (level: number): Unlock[] => unlocks.filter((u) => u.level === level);

export const nextUnlock = (level: number, among: Feature[] = unlocks.map((u) => u.feature)): Unlock | undefined =>
  unlocks.filter((u) => among.includes(u.feature) && u.level > level).sort((a, b) => a.level - b.level)[0];

export const levelsToGo = (feature: Feature, level: number) => Math.max(0, unlockOf(feature).level - level);

export const levelsToGoText = (feature: Feature, level: number) => {
  const left = levelsToGo(feature, level);
  return `${left} ${left === 1 ? "level" : "levels"} to go`;
};
