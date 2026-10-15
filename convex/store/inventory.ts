import { v } from "convex/values";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { ParseHook } from "../parser/parser";
import { openedAtOf, stateOf } from "../unlocks/unlocks";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { catalogue, itemOf, starterItem, type CatalogueItem, type ItemId } from "./catalogue";
import type { CollectedItem, Slot } from "./rows";
import { storeVisibleAndExposedTo, storeVisibleTo } from "./visibility";

export type LoadoutSlot = { slot: Slot; item: ItemId | null };

export type OwnedItem = { item: ItemId; arrivedAt: number };

export type Inventory = {
  slots: LoadoutSlot[];
  owned: OwnedItem[];
  catalogue: Array<CatalogueItem & { onSale: boolean }>;
};

export type InventoryHome = { slots: Array<CatalogueItem | null>; collection: CatalogueItem[] };

export const slots: readonly Slot[] = ["emoji-1", "emoji-2", "emoji-3"];

export const loadoutHook: ParseHook = {
  name: "loadout",
  kudosEmoji: (ctx, { giver }) => (giver === undefined ? Promise.resolve([]) : loadoutEmojiOf(ctx, giver)),
};

export const inventoryOf = internalQuery({
  args: { member: v.id("members") },
  handler: async (ctx, { member }): Promise<Inventory | null> => ((await storeVisibleTo(ctx, member)) ? inventoryFor(ctx, member) : null),
});

export async function loadoutEmojiOf(ctx: QueryCtx, member: MemberId): Promise<string[]> {
  const visible = isMutation(ctx) ? await storeVisibleAndExposedTo(ctx, member) : await storeVisibleTo(ctx, member);
  if (!visible) return [];
  return (await loadoutOf(ctx, member)).flatMap(({ item }) => (item === null ? [] : (itemOf(item)?.emoji ?? [])));
}

export async function loadoutOf(ctx: QueryCtx, member: MemberId): Promise<LoadoutSlot[]> {
  const stored = await ctx.db
    .query("loadouts")
    .withIndex("by_member_slot", (q) => q.eq("member", member))
    .collect();
  if (stored.length === 0) return slots.map((slot) => ({ slot, item: slot === "emoji-1" ? starterItem : null }));
  return slots.map((slot) => ({ slot, item: stored.find((row) => row.slot === slot)?.item ?? null }));
}

export async function inventoryHomeOf(ctx: QueryCtx, member: MemberId): Promise<InventoryHome> {
  const loadout = await loadoutOf(ctx, member);
  const slotted = new Set(loadout.map(({ item }) => item));
  const unslotted = (await ownedBy(ctx, member)).filter(({ item }) => !slotted.has(item));
  return { slots: loadout.map(({ item }) => (item === null ? null : (itemOf(item) ?? null))), collection: unslotted.flatMap(({ item }) => itemOf(item) ?? []) };
}

export async function grantItem(ctx: MutationCtx, granted: CollectedItem): Promise<boolean> {
  if ((await collectedRow(ctx, granted.member, granted.item)) !== null) return false;
  await ctx.db.insert("collection", granted);
  return true;
}

export async function ownedBy(ctx: QueryCtx, member: MemberId): Promise<OwnedItem[]> {
  const openedAt = await openedAtOf(ctx, member, "coins");
  const starter = openedAt === null ? [] : [{ item: starterItem, arrivedAt: openedAt }];
  const collected = await ctx.db
    .query("collection")
    .withIndex("by_member_item", (q) => q.eq("member", member))
    .collect();
  const granted = collected.sort((a, b) => a.arrivedAt - b.arrivedAt).map(({ item, arrivedAt }) => ({ item, arrivedAt }));
  return [...starter, ...granted];
}

async function inventoryFor(ctx: QueryCtx, member: MemberId): Promise<Inventory> {
  const loadout = await loadoutOf(ctx, member);
  const owned = await ownedBy(ctx, member);
  const ownedOrSlotted = new Set([...owned.map(({ item }) => item), ...loadout.flatMap(({ item }) => (item === null ? [] : [item]))]);
  const workspaceEmoji = await workspaceEmojiOf(ctx, member);
  const bookOpen = (await stateOf(ctx, member, "book")) === "open";
  const forSale = (entry: CatalogueItem) => listedIn(workspaceEmoji, entry) && !ownedOrSlotted.has(entry.item);
  const notYoursYet = (entry: CatalogueItem) => entry.source.kind === "tier" && bookOpen && entry.emoji !== workspaceEmoji;
  const shown = (entry: CatalogueItem) => ownedOrSlotted.has(entry.item) || forSale(entry) || notYoursYet(entry);
  return {
    slots: loadout,
    owned,
    catalogue: catalogue.items.filter(shown).map((entry) => ({ ...entry, onSale: forSale(entry) })),
  };
}

function isMutation(ctx: QueryCtx | MutationCtx): ctx is MutationCtx {
  return "insert" in ctx.db;
}

function listedIn(workspaceEmoji: string, { source, emoji }: CatalogueItem) {
  return source.kind === "store" && emoji !== workspaceEmoji;
}

async function workspaceEmojiOf(ctx: QueryCtx, member: MemberId) {
  return (await settingsOf(ctx, (await chatUserOf(ctx, member)).workspace)).kudosEmoji;
}

function collectedRow(ctx: QueryCtx, member: MemberId, item: ItemId) {
  return ctx.db
    .query("collection")
    .withIndex("by_member_item", (q) => q.eq("member", member).eq("item", item))
    .unique();
}
