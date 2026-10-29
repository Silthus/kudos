import type { Doc, Id } from "../_generated/dataModel";
import type { WithoutSystemFields } from "convex/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Rarity } from "./hoggies/catalogue";
import { dropFor, dropOf, packOf, type Drop } from "./hoggies/drops";
import { hoggiesShownTo } from "./hoggies/flag";
import { earnItem, isTurned, markTurned } from "./items/ledger";
import type { AppliedReward } from "../progression/rewards";
import type { MemberId } from "../workspace/directory";
import { crateKeyOf, thanksEarningOf, thoughtfulCratePrefix } from "./packs";
import { dropRandomEmojiFrom } from "./randomEmojis";
import { tallyPackOpened } from "./tallies";

export const mostTrayItemsShown = 100;

export type TrayItem = { item: Id<"trayItems">; kind: "sticker"; person: MemberId } | { item: Id<"trayItems">; kind: "hoggie"; hoggie: string; rarity: Rarity; isNew: boolean };

export type Opening = { items: TrayItem[]; applied: AppliedReward | null };

type PackId = Id<"thoughtfulPacks">;

export async function openThoughtfulPack(ctx: MutationCtx, member: MemberId, pack: PackId, at: number): Promise<Opening | null> {
  const waiting = await ctx.db.get(pack);
  if (waiting?.giver !== member || waiting.openedAt !== undefined || !(await hoggiesShownTo(ctx, member))) return null;
  const crate = crateKeyOf(pack);
  const unseen = await unseenItemsOf(ctx, waiting);
  await dropFor(ctx, member, crate, at, { surface: "website", waits: true });
  const drop = await dropOf(ctx, member, crate);
  if (drop === null) return null;
  await ctx.db.patch(pack, { openedAt: at });
  await markTurned(ctx, member, "hoggie", crate, at);
  await tallyPackOpened(ctx, member, at);
  await dropRandomEmojiFrom(ctx, member, pack, crate, at);
  return { items: await intoTheTray(ctx, waiting, drop, unseen, at), applied: unseen.hoggie ? await packOf(ctx, member, crate) : null };
}

export async function openThePackOnceAllTurned(ctx: MutationCtx, item: Doc<"items">, at: number): Promise<void> {
  const pack = packHolding(ctx, item);
  const waiting = pack === null ? null : await ctx.db.get(pack);
  if (waiting === null || waiting.openedAt !== undefined) return;
  const unseen = await unseenItemsOf(ctx, waiting);
  if (!unseen.sticker && !unseen.hoggie) await ctx.db.patch(waiting._id, { openedAt: at });
}

function packHolding(ctx: QueryCtx, { source, key }: Doc<"items">): PackId | null {
  if (source === "sticker") return ctx.db.normalizeId("thoughtfulPacks", key);
  return key.startsWith(thoughtfulCratePrefix) ? ctx.db.normalizeId("thoughtfulPacks", key.slice(thoughtfulCratePrefix.length)) : null;
}

type Unseen = { sticker: boolean; hoggie: boolean };

async function unseenItemsOf(ctx: QueryCtx, { _id, giver, holdsSticker }: Doc<"thoughtfulPacks">): Promise<Unseen> {
  return { sticker: holdsSticker && !(await isTurned(ctx, giver, "sticker", _id)), hoggie: !(await isTurned(ctx, giver, "hoggie", crateKeyOf(_id))) };
}

export async function trayOf(ctx: QueryCtx, member: MemberId): Promise<{ tray: TrayItem[]; more: boolean }> {
  const inOpeningOrder = await ctx.db
    .query("trayItems")
    .withIndex("by_member_put_in", (q) => q.eq("member", member).eq("putInAt", undefined))
    .take(mostTrayItemsShown + 1);
  return { tray: inOpeningOrder.slice(0, mostTrayItemsShown).map(shownTrayItem), more: inOpeningOrder.length > mostTrayItemsShown };
}

async function intoTheTray(ctx: MutationCtx, pack: Doc<"thoughtfulPacks">, drop: Drop, unseen: Unseen, at: number): Promise<TrayItem[]> {
  const items: TrayItem[] = [];
  const placed = { member: pack.giver, pack: pack._id, at };
  if (unseen.sticker) items.push(await waitInTheTray(ctx, pack, { ...placed, kind: "sticker", person: pack.recipient }));
  if (unseen.hoggie) items.push(await waitInTheTray(ctx, pack, { ...placed, kind: "hoggie", hoggie: drop.hoggie, rarity: drop.rarity, isNew: drop.isNew }));
  return items;
}

async function waitInTheTray(ctx: MutationCtx, pack: Doc<"thoughtfulPacks">, placed: WithoutSystemFields<Doc<"trayItems">>): Promise<TrayItem> {
  const item = await ctx.db.insert("trayItems", placed);
  const stored = (await ctx.db.get(item))!;
  await earnTrayItem(ctx, stored, pack);
  return shownTrayItem(stored);
}

export async function earnTrayItem(ctx: MutationCtx, item: Doc<"trayItems">, pack: Doc<"thoughtfulPacks">): Promise<void> {
  const earning = thanksEarningOf(pack);
  await earnItem(ctx, item.kind === "sticker" ? { ...earning, source: "sticker", key: pack._id } : { ...earning, source: "hoggie", key: trayKeyOf(item._id) });
}

const trayKeyPrefix = "tray:";

export function trayKeyOf(item: Id<"trayItems">): string {
  return `${trayKeyPrefix}${item}`;
}

export function isTrayKey(key: string): boolean {
  return key.startsWith(trayKeyPrefix);
}

export async function trayItemKeyed(ctx: QueryCtx, key: string): Promise<Doc<"trayItems"> | null> {
  const item = isTrayKey(key) ? ctx.db.normalizeId("trayItems", key.slice(trayKeyPrefix.length)) : null;
  return item === null ? null : ctx.db.get(item);
}

export function shownTrayItem(stored: Doc<"trayItems">): TrayItem {
  if (stored.kind === "sticker") return { item: stored._id, kind: "sticker", person: stored.person };
  return { item: stored._id, kind: "hoggie", hoggie: stored.hoggie, rarity: stored.rarity, isNew: stored.isNew };
}
