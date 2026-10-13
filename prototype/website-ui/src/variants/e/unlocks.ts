// Variant E progressive unlocks: which level makes each part of HedgeHug ready, which crates the member has opened, which crate is on screen, and a preview level to see the site as a newer member would.
import { useSyncExternalStore } from "react";
import { me } from "../../data/mock";

const schedule = [
  { feature: "book", level: 2, name: "The Book", teaser: "Sticker albums for every team, and your achievements.", how: "Every teammate who thanks you becomes a sticker." },
  { feature: "gear", level: 3, name: "Character and inventory", teaser: "Equip a title, quips and extra kudos emoji.", how: "Things you earn before then wait for you here." },
  { feature: "skills", level: 4, name: "Skill tree", teaser: "Spend skill points on perks that make every thank-you count for more.", how: "Every level from 2 gives a skill point. They wait for you until then." },
  { feature: "coins", level: 5, name: "Coins", teaser: "Coins buy hedgehogs and perk upgrades.", how: "A thoughtful kudos, one that says why in at least five words, can earn coins." },
  { feature: "collection", level: 5, name: "Hedgehog collection", teaser: "Collect hedgehogs and pick one as your avatar.", how: "Find them, earn them, or buy them with coins." },
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
