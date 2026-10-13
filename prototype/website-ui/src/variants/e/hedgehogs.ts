// PROTOTYPE: hedgehogs as a collectable avatar (an idea from round 4, not in the progression spec yet).
// Facts are mocked; the equipped hedgehog lives in a tiny in-memory store shared by every E screen.
import { useSyncExternalStore, type ComponentType } from "react";
import {
  HedgehogAngel,
  HedgehogChef,
  HedgehogDj,
  HedgehogExplorer,
  HedgehogGardener,
  HedgehogGladiator,
  HedgehogLevelUp,
  HedgehogReading,
  HedgehogRocket,
  HedgehogSitting,
  HedgehogSuperhero,
  HedgehogWizard,
} from "@posthog/brand/hoggies";
import type { Rarity } from "../../data/types";

export type HogSource =
  | { kind: "starter" }
  | { kind: "level"; level: number }
  | { kind: "achievement"; tier: string }
  | { kind: "store"; price: number }
  | { kind: "drop" };

export type Hog = {
  id: string;
  name: string;
  Art: ComponentType<{ size?: number; className?: string; title?: string }>;
  rarity: Rarity;
  source: HogSource;
  owned: boolean;
};

export const hedgehogs: Hog[] = [
  { id: "hog-sitting", name: "Sunday Hog", Art: HedgehogSitting, rarity: "common", source: { kind: "starter" }, owned: true },
  { id: "hog-superhero", name: "Super Hog", Art: HedgehogSuperhero, rarity: "rare", source: { kind: "level", level: 5 }, owned: true },
  { id: "hog-level-up", name: "1-Up Hog", Art: HedgehogLevelUp, rarity: "uncommon", source: { kind: "level", level: 8 }, owned: true },
  { id: "hog-explorer", name: "Explorer", Art: HedgehogExplorer, rarity: "uncommon", source: { kind: "achievement", tier: "Social Butterfly" }, owned: true },
  { id: "hog-reading", name: "Bookworm", Art: HedgehogReading, rarity: "common", source: { kind: "store", price: 120 }, owned: false },
  { id: "hog-gardener", name: "Gardener", Art: HedgehogGardener, rarity: "uncommon", source: { kind: "store", price: 300 }, owned: false },
  { id: "hog-chef", name: "Chef", Art: HedgehogChef, rarity: "rare", source: { kind: "store", price: 700 }, owned: false },
  { id: "hog-dj", name: "DJ Hog", Art: HedgehogDj, rarity: "epic", source: { kind: "store", price: 1500 }, owned: false },
  { id: "hog-rocket", name: "Rocket Hog", Art: HedgehogRocket, rarity: "rare", source: { kind: "level", level: 10 }, owned: false },
  { id: "hog-wizard", name: "Wizard", Art: HedgehogWizard, rarity: "epic", source: { kind: "achievement", tier: "Patron of Praise" }, owned: false },
  { id: "hog-gladiator", name: "Gladiator", Art: HedgehogGladiator, rarity: "legendary", source: { kind: "drop" }, owned: false },
  { id: "hog-angel", name: "Angel", Art: HedgehogAngel, rarity: "legendary", source: { kind: "store", price: 3000 }, owned: false },
];

export function sourceLabel(source: HogSource): string {
  switch (source.kind) {
    case "starter":
      return "Everyone starts with this one";
    case "level":
      return `Unlocks at level ${source.level}`;
    case "achievement":
      return `Unlocked by ${source.tier}`;
    case "store":
      return `${source.price.toLocaleString()} coins in the store`;
    case "drop":
      return "Only found as a drop";
  }
}

let equippedId = "hog-superhero";
const owned = new Set(hedgehogs.filter((h) => h.owned).map((h) => h.id));
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useHogs() {
  useSyncExternalStore(subscribe, () => version);
  const equipped = hedgehogs.find((h) => h.id === equippedId) ?? hedgehogs[0];
  return {
    equipped,
    isOwned: (id: string) => owned.has(id),
    equip: (id: string) => {
      if (!owned.has(id)) return;
      equippedId = id;
      emit();
    },
    buy: (id: string) => {
      owned.add(id);
      emit();
    },
  };
}
