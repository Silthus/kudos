// Variant E progressive unlocks: which level makes each part of HedgeHug ready, which crates the member has opened, which crate is on screen, and a preview level to see the site as a newer member would.
import { useSyncExternalStore } from "react";
import { me } from "../../data/mock";

const schedule = [
  { feature: "quests", level: 2, name: "Quests", teaser: "Three weekly quests, plus one your whole group works on together.", how: "New quests every Monday. Each one pays out in a reward crate." },
  { feature: "leaderboard", level: 3, name: "Leaderboard", teaser: "See where you and your group stand this week.", how: "Only kudos given count, so anyone can top it." },
  { feature: "book", level: 4, name: "The Book", teaser: "Sticker albums for every team, and your achievements.", how: "Every teammate who thanks you becomes a sticker." },
  { feature: "skills", level: 5, name: "Skill tree", teaser: "Spend skill points on perks that make your kudos worth more XP or coins, or give you more kudos.", how: "Skill points start at level 5: one per level." },
  { feature: "coins", level: 6, name: "Coins", teaser: "Coins buy hedgehogs and extra kudos emoji.", how: "A thoughtful kudos, one that says why in at least five words, earns coins." },
  { feature: "inventory", level: 6, name: "Inventory", teaser: "Your hedgehog avatar slot, plus three slots for kudos emoji.", how: "Emoji you earn before then wait for you here." },
  { feature: "collection", level: 7, name: "Hedgehog collection", teaser: "Collect hedgehogs and pick one as your avatar.", how: "Earn them from levels, achievements and quests, or buy them with coins." },
] as const;

export type Feature = (typeof schedule)[number]["feature"];

export type FeatureState = "locked" | "ready" | "unlocked";

export type Unlock = { feature: Feature; level: number; name: string; teaser: string; how: string };

export const unlocks: readonly Unlock[] = [...schedule].sort((a, b) => a.level - b.level);

export const unlockOf = (feature: Feature) => unlocks.find((u) => u.feature === feature)!;

export const reachedAt = (feature: Feature, level: number) => level >= unlockOf(feature).level;

const initialLevel = () => {
  const fromUrl = Number(new URLSearchParams(location.search).get("lvl"));
  return Number.isInteger(fromUrl) && fromUrl >= 1 ? fromUrl : me.level;
};

const reachedFeatures = (level: number) => unlocks.filter((u) => u.level <= level).map((u) => u.feature);

let previewLevel = initialLevel();
let opened = new Set<Feature>(reachedFeatures(Math.min(me.level, previewLevel)));
let openings = 0;
let lastOpened: { feature: Feature; at: number } | undefined;
let shownCrate: Feature | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const featureStateAt = (feature: Feature, level: number): FeatureState => (!reachedAt(feature, level) ? "locked" : opened.has(feature) ? "unlocked" : "ready");

export const unlockedAt = (feature: Feature, level: number) => featureStateAt(feature, level) === "unlocked";

export const readyAt = (level: number) => unlocks.filter((u) => featureStateAt(u.feature, level) === "ready").map((u) => u.feature);

export function setPreviewLevel(level: number) {
  previewLevel = Math.max(1, level);
  opened = new Set([...opened].filter((f) => reachedAt(f, previewLevel)));
  if (shownCrate && !reachedAt(shownCrate, previewLevel)) shownCrate = null;
  const url = new URL(location.href);
  if (previewLevel === me.level) url.searchParams.delete("lvl");
  else url.searchParams.set("lvl", String(previewLevel));
  history.replaceState(null, "", url);
  notify();
}

export function openUnlock(feature: Feature) {
  if (!reachedAt(feature, previewLevel) || opened.has(feature)) return;
  opened = new Set(opened).add(feature);
  openings += 1;
  lastOpened = { feature, at: Date.now() };
  notify();
}

export function markReady(features: Feature[]) {
  const closing = features.filter((f) => opened.has(f));
  if (closing.length === 0) return;
  opened = new Set([...opened].filter((f) => !closing.includes(f)));
  notify();
}

export function showCrate(feature: Feature | null) {
  shownCrate = feature;
  notify();
}

export const justOpened = (feature: Feature, withinMs = 4000) => lastOpened?.feature === feature && Date.now() - lastOpened.at < withinMs;

export function usePreviewLevel() {
  return useSyncExternalStore(subscribe, () => previewLevel);
}

export function useFeatureState(feature: Feature) {
  return useSyncExternalStore(subscribe, () => featureStateAt(feature, previewLevel));
}

export function useUnlocked(feature: Feature) {
  return useFeatureState(feature) === "unlocked";
}

export function useReadyFeatures() {
  const key = useSyncExternalStore(subscribe, () => readyAt(previewLevel).join(" "));
  return key ? (key.split(" ") as Feature[]) : [];
}

export function useOpenings() {
  return useSyncExternalStore(subscribe, () => openings);
}

export function useShownCrate() {
  return useSyncExternalStore(subscribe, () => shownCrate);
}
