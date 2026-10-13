// PROTOTYPE: hedgehogs as a collectable avatar, and the one in-memory gear store every E screen shares: hedgehog, title, quips, kudos emoji and coins, with the slot a new quip or emoji lands in.
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
import { me } from "../../data/mock";
import type { Rarity } from "../../data/types";
import { gear, gearById, gearIdFor, slotCount, type GearKind } from "./gear-items";
import { useUnlocked } from "./unlocks";

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

export type SlotKind = GearKind | "hedgehog";

export type SlotRef = { kind: SlotKind; index: number };

const filled = (kind: GearKind, seeds: string[]) => Array.from({ length: slotCount[kind] }, (_, i) => (seeds[i] ? (gearIdFor(kind, seeds[i]) ?? null) : null));

const state = {
  hogId: "hog-superhero",
  coins: me.coins,
  owned: new Set([...hedgehogs.filter((h) => h.owned).map((h) => h.id), ...gear.filter((g) => g.owned).map((g) => g.id)]),
  slots: { title: filled("title", [me.loadout.title]), quip: filled("quip", me.loadout.quips), emoji: filled("emoji", me.loadout.emoji) } as Record<GearKind, (string | null)[]>,
  equippedAt: { title: [0], quip: [0, 1, 2], emoji: [0, 1, 2] } as Record<GearKind, number[]>,
  clock: 3,
};

export const starterHog = hedgehogs.find((h) => h.source.kind === "starter")!;

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

const hogById = (id: string) => hedgehogs.find((h) => h.id === id);

function equipHog(id: string) {
  if (!state.owned.has(id) || !hogById(id)) return;
  state.hogId = id;
  emit();
}

function equipGear(kind: GearKind, index: number, id: string) {
  if (!state.owned.has(id) || gearById(id)?.kind !== kind) return;
  const slots = [...state.slots[kind]];
  const from = slots.indexOf(id);
  if (from >= 0) slots[from] = slots[index];
  slots[index] = id;
  state.slots = { ...state.slots, [kind]: slots };
  state.equippedAt = { ...state.equippedAt, [kind]: state.equippedAt[kind].map((at, i) => (i === index ? ++state.clock : at)) };
  emit();
}

function unequip(kind: GearKind, index: number) {
  if (kind === "title") return;
  state.slots = { ...state.slots, [kind]: state.slots[kind].map((id, i) => (i === index ? null : id)) };
  emit();
}

function slotForNew(kind: GearKind) {
  const empty = state.slots[kind].indexOf(null);
  if (empty >= 0) return empty;
  const at = state.equippedAt[kind];
  return at.indexOf(Math.min(...at));
}

const priceOf = (id: string) => {
  const hog = hogById(id);
  if (hog) return hog.source.kind === "store" ? hog.source.price : undefined;
  return gearById(id)?.price;
};

function buy(id: string) {
  const price = priceOf(id);
  if (price === undefined || state.owned.has(id) || price > state.coins) return;
  state.coins -= price;
  state.owned.add(id);
  emit();
}

export function useGear() {
  useSyncExternalStore(subscribe, () => version);
  return {
    hog: hogById(state.hogId) ?? hedgehogs[0],
    coins: state.coins,
    slots: state.slots,
    isOwned: (id: string) => state.owned.has(id),
    isEquipped: (id: string) => state.hogId === id || Object.values(state.slots).some((s) => s.includes(id)),
    itemIn: (kind: GearKind, index: number) => gearById(state.slots[kind][index] ?? ""),
    slotOf: (kind: GearKind, id: string) => state.slots[kind].indexOf(id),
    slotForNew,
    equipHog,
    equipGear,
    unequip,
    buy,
  };
}

export function useHogs() {
  const g = useGear();
  const collectionOpen = useUnlocked("collection");
  return { equipped: collectionOpen ? g.hog : starterHog, isOwned: g.isOwned, equip: g.equipHog, buy: g.buy, coins: g.coins };
}
