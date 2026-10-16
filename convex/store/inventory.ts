import { v } from "convex/values";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { ParseHook } from "../parser/parser";
import { openedAtOf, stateOf } from "../unlocks/unlocks";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";
import { catalogue, isCustomItem, itemOf, kudosEmojiNameOf, starterItem, type CatalogueItem, type ItemId, type StoreItem, type TierItem } from "./catalogue";
import { customItemsShownAndExposedTo, customItemsShownTo, customKudosEmojiShownAndExposedTo, customKudosEmojiShownTo, type CustomItems } from "./customKudosEmoji";
import { slots, type CollectedItem, type Slot } from "./rows";
import { slotsRetiredAndExposedFor, slotsRetiredFor, storeVisibleAndExposedTo, storeVisibleTo } from "./visibility";

export type { StoreItem } from "./catalogue";

export type LoadoutSlot = { slot: Slot; item: ItemId | null };

export type OwnedItem = { item: ItemId; arrivedAt: number };

export type Inventory = {
  slots: LoadoutSlot[];
  owned: OwnedItem[];
  catalogue: Array<CatalogueItem & { onSale: boolean }>;
};

export type InventoryHome = ({ kind: "slots"; slots: Array<CatalogueItem | null>; collection: CatalogueItem[] } | { kind: "owned"; owned: CatalogueItem[]; customShown: StoreItem[] }) & { store: StoreItem[]; notYoursYet: TierItem[] };

export const loadoutHook: ParseHook = {
  name: "loadout",
  kudosEmoji: (ctx, { giver }) => (giver === undefined ? Promise.resolve([]) : kudosEmojiOwnedBy(ctx, giver)),
};

export const inventoryOf = internalQuery({
  args: { member: v.id("members") },
  handler: (ctx, { member }) => visibleInventoryOf(ctx, member),
});

export async function visibleInventoryOf(ctx: QueryCtx, member: MemberId): Promise<Inventory | null> {
  return (await storeVisibleTo(ctx, member)) ? inventoryFor(ctx, member) : null;
}

async function kudosEmojiOwnedBy(ctx: MutationCtx, member: MemberId): Promise<string[]> {
  if (!(await storeVisibleAndExposedTo(ctx, member))) return [];
  return (await slotsRetiredAndExposedFor(ctx, member)) ? everyOwnedEmojiOf(ctx, member) : loadoutEmojiOf(ctx, member);
}

async function everyOwnedEmojiOf(ctx: MutationCtx, member: MemberId): Promise<string[]> {
  const collected = await collectedBy(ctx, member);
  const customShown = collected.some(({ item }) => isCustomItem(item)) && (await customKudosEmojiShownAndExposedTo(ctx, member));
  const owned = [starterItem, ...collected.map(({ item }) => item).filter((item) => customShown || !isCustomItem(item))];
  return owned.flatMap((item) => kudosEmojiNameOf(item) ?? []);
}

async function loadoutEmojiOf(ctx: MutationCtx, member: MemberId): Promise<string[]> {
  const stored = await storedLoadoutOf(ctx, member);
  const customShown = stored.some(({ item }) => isCustomItem(item)) && (await customKudosEmojiShownAndExposedTo(ctx, member));
  return loadoutShown(stored, customShown).flatMap(({ item }) => (item === null ? [] : (kudosEmojiNameOf(item) ?? [])));
}

export async function loadoutOf(ctx: QueryCtx, member: MemberId): Promise<LoadoutSlot[]> {
  const stored = await storedLoadoutOf(ctx, member);
  return loadoutShown(stored, stored.some(({ item }) => isCustomItem(item)) && (await customKudosEmojiShownTo(ctx, member)));
}

export async function inventoryHomeOf(ctx: MutationCtx, member: MemberId): Promise<InventoryHome> {
  const known = itemsKnownWith(await customItemsShownAndExposedTo(ctx, member));
  if (await slotsRetiredAndExposedFor(ctx, member)) return ownedHomeOf(ctx, member, known);
  const loadout = await loadoutOf(ctx, member);
  const slotted = new Set(loadout.map(({ item }) => item));
  const owned = await ownedBy(ctx, member);
  const unslotted = owned.filter(({ item }) => !slotted.has(item));
  const ownedOrSlotted = new Set([...slotted, ...owned.map(({ item }) => item)]);
  const workspaceEmoji = await workspaceEmojiOf(ctx, member);
  const store = storeItemsIn(workspaceEmoji, known.custom).filter(({ item }) => !ownedOrSlotted.has(item));
  const notYoursYet = (await tierItemsListedFor(ctx, member, workspaceEmoji)).filter(({ item }) => !ownedOrSlotted.has(item));
  return { kind: "slots", slots: loadout.map(({ item }) => (item === null ? null : (known.itemOf(item) ?? null))), collection: unslotted.flatMap(({ item }) => known.itemOf(item) ?? []), store, notYoursYet };
}

async function ownedHomeOf(ctx: MutationCtx, member: MemberId, known: KnownItems): Promise<InventoryHome> {
  const owned = await ownedBy(ctx, member);
  const ownedItems = new Set(owned.map(({ item }) => item));
  const workspaceEmoji = await workspaceEmojiOf(ctx, member);
  const store = storeItemsIn(workspaceEmoji, known.custom, { slotsRetired: true }).filter(({ item }) => !ownedItems.has(item));
  const notYoursYet = (await tierItemsListedFor(ctx, member, workspaceEmoji)).filter(({ item }) => !ownedItems.has(item));
  return { kind: "owned", owned: owned.flatMap(({ item }) => known.itemOf(item) ?? []), customShown: known.custom.all, store, notYoursYet };
}

export async function grantItem(ctx: MutationCtx, granted: CollectedItem): Promise<boolean> {
  if ((await collectedRow(ctx, granted.member, granted.item)) !== null) return false;
  await ctx.db.insert("collection", granted);
  return true;
}

export async function storeItemFor(ctx: QueryCtx, member: MemberId, item: ItemId): Promise<StoreItem | null> {
  const custom = isCustomItem(item) ? await customItemsShownTo(ctx, member) : undefined;
  const shelf = { slotsRetired: await slotsRetiredFor(ctx, member) };
  return storeItemsIn(await workspaceEmojiOf(ctx, member), custom, shelf).find((entry) => entry.item === item) ?? null;
}

export async function owns(ctx: QueryCtx, member: MemberId, item: ItemId): Promise<boolean> {
  return (await collectedRow(ctx, member, item)) !== null;
}

export async function ownedBy(ctx: QueryCtx, member: MemberId): Promise<OwnedItem[]> {
  const openedAt = await openedAtOf(ctx, member, "coins");
  const starter = openedAt === null ? [] : [{ item: starterItem, arrivedAt: openedAt }];
  const collected = await collectedBy(ctx, member);
  const customHidden = collected.some(({ item }) => isCustomItem(item)) && !(await customKudosEmojiShownTo(ctx, member));
  const shown = customHidden ? collected.filter(({ item }) => !isCustomItem(item)) : collected;
  const granted = shown.sort((a, b) => a.arrivedAt - b.arrivedAt).map(({ item, arrivedAt }) => ({ item, arrivedAt }));
  return [...starter, ...granted];
}

async function inventoryFor(ctx: QueryCtx, member: MemberId): Promise<Inventory> {
  const known = itemsKnownWith(await customItemsShownTo(ctx, member));
  const slotsRetired = await slotsRetiredFor(ctx, member);
  const loadout = slotsRetired ? [] : await loadoutOf(ctx, member);
  const owned = await ownedBy(ctx, member);
  const ownedOrSlotted = new Set([...owned.map(({ item }) => item), ...loadout.flatMap(({ item }) => (item === null ? [] : [item]))]);
  const workspaceEmoji = await workspaceEmojiOf(ctx, member);
  const sold = new Set(storeItemsIn(workspaceEmoji, known.custom, { slotsRetired }).map(({ item }) => item));
  const tierItems = new Set((await tierItemsListedFor(ctx, member, workspaceEmoji)).map(({ item }) => item));
  const forSale = (entry: CatalogueItem) => sold.has(entry.item) && !ownedOrSlotted.has(entry.item);
  const shown = (entry: CatalogueItem) => ownedOrSlotted.has(entry.item) || forSale(entry) || tierItems.has(entry.item);
  return {
    slots: loadout,
    owned,
    catalogue: known.items.filter(shown).map((entry) => ({ ...entry, onSale: forSale(entry) })),
  };
}

type KnownItems = ReturnType<typeof itemsKnownWith>;

function itemsKnownWith(custom: CustomItems) {
  const items: CatalogueItem[] = [...catalogue.items, ...custom.all];
  return { custom, items, itemOf: (item: ItemId) => (isCustomItem(item) ? custom.all.find((entry) => entry.item === item) : itemOf(item)) };
}

async function storedLoadoutOf(ctx: QueryCtx, member: MemberId): Promise<LoadoutSlot[]> {
  const stored = await ctx.db
    .query("loadouts")
    .withIndex("by_member_slot", (q) => q.eq("member", member))
    .collect();
  if (stored.length === 0) return slots.map((slot) => ({ slot, item: slot === "emoji-1" ? starterItem : null }));
  return slots.map((slot) => ({ slot, item: stored.find((row) => row.slot === slot)?.item ?? null }));
}

function loadoutShown(stored: LoadoutSlot[], customShown: boolean): LoadoutSlot[] {
  return customShown ? stored : stored.map(({ slot, item }) => ({ slot, item: isCustomItem(item) ? null : item }));
}

function listedIn(workspaceEmoji: string, entry: CatalogueItem): entry is StoreItem {
  return entry.source.kind === "store" && entry.emoji !== workspaceEmoji;
}

async function tierItemsListedFor(ctx: QueryCtx, member: MemberId, workspaceEmoji: string): Promise<TierItem[]> {
  if ((await stateOf(ctx, member, "book")) !== "open") return [];
  return catalogue.items.filter((entry: CatalogueItem): entry is TierItem => entry.source.kind === "tier" && entry.emoji !== workspaceEmoji);
}

function storeItemsIn(workspaceEmoji: string, custom?: CustomItems, { slotsRetired } = { slotsRetired: false }): StoreItem[] {
  const standard = slotsRetired ? [] : catalogue.items;
  return [...standard, ...(custom?.picked ?? [])].filter((entry: CatalogueItem) => listedIn(workspaceEmoji, entry));
}

async function workspaceEmojiOf(ctx: QueryCtx, member: MemberId) {
  return (await settingsOf(ctx, (await chatUserOf(ctx, member)).workspace)).kudosEmoji;
}

function collectedBy(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("collection")
    .withIndex("by_member_item", (q) => q.eq("member", member))
    .collect();
}

function collectedRow(ctx: QueryCtx, member: MemberId, item: ItemId) {
  return ctx.db
    .query("collection")
    .withIndex("by_member_item", (q) => q.eq("member", member).eq("item", item))
    .unique();
}
