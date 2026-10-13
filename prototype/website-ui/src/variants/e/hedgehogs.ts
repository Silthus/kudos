// PROTOTYPE: hedgehogs as a collectable avatar, earned by level, achievement or quest or bought in the store, and the one in-memory gear store every E screen shares: hedgehog, kudos emoji and coins, with the slot a new emoji lands in.
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
import { emoji, emojiById, emojiIdFor, emojiSlots, priceOf, type ItemSource } from "./gear-items";
import { useUnlocked } from "./unlocks";

export type Hog = {
  id: string;
  name: string;
  Art: ComponentType<{ size?: number; className?: string; title?: string }>;
  source: ItemSource;
  owned: boolean;
};

export const hedgehogs: Hog[] = [
  { id: "hog-sitting", name: "Sunday Hog", Art: HedgehogSitting, source: { kind: "starter" }, owned: true },
  { id: "hog-superhero", name: "Super Hog", Art: HedgehogSuperhero, source: { kind: "level", level: 5 }, owned: true },
  { id: "hog-level-up", name: "1-Up Hog", Art: HedgehogLevelUp, source: { kind: "level", level: 8 }, owned: true },
  { id: "hog-explorer", name: "Explorer", Art: HedgehogExplorer, source: { kind: "achievement", name: "Social Butterfly" }, owned: true },
  { id: "hog-reading", name: "Bookworm", Art: HedgehogReading, source: { kind: "store", price: 120 }, owned: false },
  { id: "hog-gardener", name: "Gardener", Art: HedgehogGardener, source: { kind: "store", price: 300 }, owned: false },
  { id: "hog-chef", name: "Chef", Art: HedgehogChef, source: { kind: "store", price: 700 }, owned: false },
  { id: "hog-dj", name: "DJ Hog", Art: HedgehogDj, source: { kind: "store", price: 1500 }, owned: false },
  { id: "hog-rocket", name: "Rocket Hog", Art: HedgehogRocket, source: { kind: "level", level: 10 }, owned: false },
  { id: "hog-wizard", name: "Wizard", Art: HedgehogWizard, source: { kind: "achievement", name: "Patron of Praise" }, owned: false },
  { id: "hog-gladiator", name: "Gladiator", Art: HedgehogGladiator, source: { kind: "quest", name: "All hands" }, owned: false },
  { id: "hog-angel", name: "Angel", Art: HedgehogAngel, source: { kind: "store", price: 3000 }, owned: false },
];

export function sourceLabel(source: ItemSource): string {
  switch (source.kind) {
    case "starter":
      return "Everyone starts with this one";
    case "level":
      return `Unlocks at level ${source.level}`;
    case "achievement":
      return `Earned with ${source.name}`;
    case "quest":
      return `Reward for the ${source.name} quest`;
    case "store":
      return `${source.price.toLocaleString()} coins in the store`;
  }
}

export type SlotKind = "hedgehog" | "emoji";

export type SlotRef = { kind: SlotKind; index: number };

const state = {
  hogId: "hog-superhero",
  coins: me.coins,
  owned: new Set([...hedgehogs, ...emoji].filter((i) => i.owned).map((i) => i.id)),
  emoji: Array.from({ length: emojiSlots }, (_, i) => emojiIdFor(me.loadout.emoji[i] ?? "") ?? null),
  equippedAt: Array.from({ length: emojiSlots }, (_, i) => i),
  clock: emojiSlots,
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

function equipEmoji(index: number, id: string) {
  if (!state.owned.has(id) || !emojiById(id)) return;
  const slots = [...state.emoji];
  const from = slots.indexOf(id);
  if (from >= 0) slots[from] = slots[index];
  slots[index] = id;
  state.emoji = slots;
  state.equippedAt = state.equippedAt.map((at, i) => (i === index ? ++state.clock : at));
  emit();
}

function unequipEmoji(index: number) {
  state.emoji = state.emoji.map((id, i) => (i === index ? null : id));
  emit();
}

function slotForNewEmoji() {
  const empty = state.emoji.indexOf(null);
  return empty >= 0 ? empty : state.equippedAt.indexOf(Math.min(...state.equippedAt));
}

function buy(id: string) {
  const item = hogById(id) ?? emojiById(id);
  const price = item && priceOf(item.source);
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
    emojiSlots: state.emoji,
    isOwned: (id: string) => state.owned.has(id),
    emojiIn: (index: number) => emojiById(state.emoji[index] ?? ""),
    emojiSlotOf: (id: string) => state.emoji.indexOf(id),
    slotForNewEmoji,
    equipHog,
    equipEmoji,
    unequipEmoji,
    buy,
  };
}

export function useHogs() {
  const g = useGear();
  const collectionOpen = useUnlocked("collection");
  return { equipped: collectionOpen ? g.hog : starterHog, isOwned: g.isOwned, equip: g.equipHog, buy: g.buy, coins: g.coins };
}
