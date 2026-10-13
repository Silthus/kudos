// Variant E inventory catalogue: hedgehogs, the title, quips and kudos emoji as one list per kind, with each kind's slots and how the missing items are found.
import type { ComponentType } from "react";
import { IconEmoji, IconQuote, IconRibbon, IconUser } from "@posthog/icons";
import type { CosmeticSource, Rarity } from "../../data/types";
import { gear, slotCount, type GearItem, type GearKind } from "./gear-items";
import { hedgehogs, type Hog, type HogSource, type SlotKind } from "./hedgehogs";

type Common = { id: string; name: string; rarity: Rarity; price?: number; howToGet: string };

export type InventoryItem = (Common & { kind: "hedgehog"; hog: Hog }) | (Common & { kind: GearKind; item: GearItem });

export const inventoryKinds: SlotKind[] = ["hedgehog", "title", "quip", "emoji"];

export const kindHeading: Record<SlotKind, string> = { hedgehog: "Hedgehogs", title: "Title", quip: "Quips", emoji: "Emoji" };

export const kindIcon: Record<SlotKind, ComponentType<{ className?: string }>> = { hedgehog: IconUser, title: IconRibbon, quip: IconQuote, emoji: IconEmoji };

export const slotsFor = (kind: SlotKind) => (kind === "hedgehog" ? 1 : slotCount[kind]);

const hogHowToGet = (source: HogSource) => {
  switch (source.kind) {
    case "starter":
      return "Everyone has it";
    case "level":
      return `At level ${source.level}`;
    case "achievement":
      return `From ${source.tier}`;
    case "store":
      return "In the store";
    case "drop":
      return "Only drops";
  }
};

const gearHowToGet: Record<CosmeticSource, string> = { store: "In the store", achievement: "From an achievement", drop: "Only drops", expression: "With an Expression perk" };

const fromHog = (hog: Hog): InventoryItem => ({ kind: "hedgehog", id: hog.id, name: hog.name, rarity: hog.rarity, price: hog.source.kind === "store" ? hog.source.price : undefined, howToGet: hogHowToGet(hog.source), hog });

const fromGear = (item: GearItem): InventoryItem => ({ kind: item.kind, id: item.id, name: item.name, rarity: item.rarity, price: item.source === "store" ? item.price : undefined, howToGet: gearHowToGet[item.source], item });

export const itemsOf = (kind: SlotKind): InventoryItem[] => (kind === "hedgehog" ? hedgehogs.map(fromHog) : gear.filter((g) => g.kind === kind).map(fromGear));
