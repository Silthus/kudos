// Variant E inventory catalogue: hedgehogs and kudos emoji as one list per kind, with each kind's slots and how the missing items are earned or bought.
import type { ComponentType } from "react";
import { IconEmoji, IconUser } from "@posthog/icons";
import { emoji, emojiSlots, howToGet, priceOf, type Emoji } from "./gear-items";
import { hedgehogs, type Hog, type SlotKind, type SlotRef } from "./hedgehogs";

type Common = { id: string; name: string; price?: number; howToGet: string };

export type InventoryItem = (Common & { kind: "hedgehog"; hog: Hog }) | (Common & { kind: "emoji"; emoji: Emoji });

export const inventoryKinds: SlotKind[] = ["hedgehog", "emoji"];

export const kindHeading: Record<SlotKind, string> = { hedgehog: "Hedgehogs", emoji: "Kudos emoji" };

export const kindIcon: Record<SlotKind, ComponentType<{ className?: string }>> = { hedgehog: IconUser, emoji: IconEmoji };

export const slotsFor = (kind: SlotKind) => (kind === "hedgehog" ? 1 : emojiSlots);

export const slotName = (slot: SlotRef) => (slot.kind === "hedgehog" ? "Hedgehog" : `Emoji ${slot.index + 1}`);

const common = (item: Hog | Emoji) => ({ id: item.id, name: item.name, price: priceOf(item.source), howToGet: howToGet(item.source) });

export const itemsOf = (kind: SlotKind): InventoryItem[] =>
  kind === "hedgehog" ? hedgehogs.map((hog) => ({ kind, ...common(hog), hog })) : emoji.map((e) => ({ kind, ...common(e), emoji: e }));
