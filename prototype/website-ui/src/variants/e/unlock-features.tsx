// Variant E unlock presentation: each feature's hedgehog and destination, and the level arithmetic every locked surface shares.
import type { ComponentType } from "react";
import { HedgehogExplorer, HedgehogMoney, HedgehogOrganized, HedgehogReading, HedgehogStar, HedgehogSuperhero, HedgehogWizard } from "@posthog/brand/hoggies";
import type { ScreenId } from "../../nav";
import { unlockOf, unlocks, type Feature, type Unlock } from "./unlocks";

type HogArt = ComponentType<{ size?: number; className?: string; title?: string }>;

type FeatureLook = { Hog: HogArt; screen: ScreenId; param?: string };

export const featureLook: Record<Feature, FeatureLook> = {
  quests: { Hog: HedgehogOrganized, screen: "quests" },
  leaderboard: { Hog: HedgehogStar, screen: "leaderboard" },
  book: { Hog: HedgehogReading, screen: "stickers" },
  skills: { Hog: HedgehogWizard, screen: "skills" },
  coins: { Hog: HedgehogMoney, screen: "profile", param: "inventory" },
  inventory: { Hog: HedgehogSuperhero, screen: "profile", param: "inventory" },
  collection: { Hog: HedgehogExplorer, screen: "collection" },
};

export const screenFeature: Partial<Record<ScreenId, Feature>> = {
  quests: "quests",
  leaderboard: "leaderboard",
  skills: "skills",
  stickers: "book",
  achievements: "book",
  collection: "collection",
};


export const unlocksAtLevel = (level: number): Unlock[] => unlocks.filter((u) => u.level === level);

export const nextUnlock = (level: number, among: Feature[] = unlocks.map((u) => u.feature)): Unlock | undefined =>
  unlocks.filter((u) => among.includes(u.feature) && u.level > level).sort((a, b) => a.level - b.level)[0];

const levelsToGo = (feature: Feature, level: number) => Math.max(0, unlockOf(feature).level - level);

export const levelsToGoText = (feature: Feature, level: number) => {
  const left = levelsToGo(feature, level);
  return `${left} ${left === 1 ? "level" : "levels"} to go`;
};
