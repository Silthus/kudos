// Variant E gear catalogue: titles, quips and kudos emoji with their store prices and the plain one-line explainers. Cards no longer exist.
import { cosmetics, dropOdds } from "../../data/mock";
import type { Cosmetic, CosmeticSource } from "../../data/types";

export type GearKind = "title" | "quip" | "emoji";

export type GearItem = Omit<Cosmetic, "kind"> & { kind: GearKind; price?: number };

export const gearKinds: GearKind[] = ["title", "quip", "emoji"];

export const slotCount: Record<GearKind, number> = { title: 1, quip: 3, emoji: 3 };

export const kindName: Record<GearKind, { one: string; many: string }> = {
  title: { one: "Title", many: "Titles" },
  quip: { one: "Quip", many: "Quips" },
  emoji: { one: "Emoji", many: "Kudos emoji" },
};

export const explainer: Record<GearKind | "hedgehog", string> = {
  hedgehog: "Your avatar on your profile card, the leaderboard and the top bar.",
  title: "Shown after your name on your profile card.",
  quip: "When you give or receive kudos, one of your quips is picked at random and shown only to you and the other person. It is never posted in the channel.",
  emoji: "Extra kudos emoji you can thank with, beside the standard one.",
};

const storePrices: Record<string, number> = {
  "title-thank-you-machine": 400,
  "title-chief-cheerleader": 900,
  "quip-legend": 60,
  "quip-ship-it": 180,
  "emoji-raised-hands": 80,
  "emoji-party": 120,
  "title-pathfinder": 350,
};

const extraFinds: Cosmetic[] = [
  { id: "title-night-owl", kind: "title", name: "Night Owl", rarity: "epic", source: "drop", owned: false, preview: "🏷️" },
  { id: "title-pathfinder", kind: "title", name: "Pathfinder", rarity: "uncommon", source: "store", owned: false, preview: "🏷️" },
  { id: "quip-ten-hogs", kind: "quip", name: "Ten out of ten hedgehogs.", rarity: "rare", source: "drop", owned: false, preview: "💬" },
  { id: "emoji-party", kind: "emoji", name: "Party popper", rarity: "uncommon", source: "store", owned: false, preview: "🎉" },
];

const isGear = (c: Cosmetic): c is Cosmetic & { kind: GearKind } => c.kind !== "card";

export const gear: GearItem[] = [...cosmetics, ...extraFinds].filter(isGear).map((c) => ({ ...c, price: storePrices[c.id] }));

export const gearById = (id: string) => gear.find((g) => g.id === id);

export const gearIdFor = (kind: GearKind, nameOrGlyph: string) => gear.find((g) => g.kind === kind && (g.name === nameOrGlyph || g.preview === nameOrGlyph))?.id;

export const sourceWord: Record<CosmeticSource, string> = { store: "Bought in the store", achievement: "Earned from an achievement", drop: "Found as a drop", expression: "Picked with an Expression perk" };

export { dropOdds };
