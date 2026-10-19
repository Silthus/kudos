import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Rarity } from "../hoggies/catalogue";
import type { CrateKey } from "../hoggies/crateKey";
import { dropFor, dropOf, packOf, type Drop } from "../hoggies/drops";
import { hoggiesShownTo } from "../hoggies/flag";
import type { AppliedReward } from "../progression/rewards";
import type { MemberId } from "../workspace/directory";
import { tallyPackOpened } from "./tallies";

export const mostTrayItemsShown = 100;

export type TrayItem = { item: Id<"trayItems">; kind: "sticker"; person: MemberId } | { item: Id<"trayItems">; kind: "hoggie"; hoggie: string; rarity: Rarity; isNew: boolean };

export type Opening = { items: TrayItem[]; applied: AppliedReward | null };

type PackId = Id<"thoughtfulPacks">;

export async function openThoughtfulPack(ctx: MutationCtx, member: MemberId, pack: PackId, at: number): Promise<Opening | null> {
  const waiting = await ctx.db.get(pack);
  if (waiting?.giver !== member || waiting.openedAt !== undefined || !(await hoggiesShownTo(ctx, member))) return null;
  const crate = crateKeyOf(pack);
  await dropFor(ctx, member, crate, at, "website");
  const drop = await dropOf(ctx, member, crate);
  if (drop === null) return null;
  await ctx.db.patch(pack, { openedAt: at });
  await tallyPackOpened(ctx, member, at);
  return { items: await intoTheTray(ctx, waiting, drop, at), applied: await packOf(ctx, member, crate) };
}

export async function trayOf(ctx: QueryCtx, member: MemberId): Promise<{ tray: TrayItem[]; more: boolean }> {
  const inOpeningOrder = await ctx.db
    .query("trayItems")
    .withIndex("by_member_put_in", (q) => q.eq("member", member).eq("putInAt", undefined))
    .take(mostTrayItemsShown + 1);
  return { tray: inOpeningOrder.slice(0, mostTrayItemsShown).map(shownTrayItem), more: inOpeningOrder.length > mostTrayItemsShown };
}

export function crateKeyOf(pack: PackId): CrateKey {
  return `thoughtful:${pack}`;
}

async function intoTheTray(ctx: MutationCtx, { _id: pack, giver: member, recipient, holdsSticker }: Doc<"thoughtfulPacks">, drop: Drop, at: number): Promise<TrayItem[]> {
  const items: TrayItem[] = [];
  if (holdsSticker) items.push({ item: await ctx.db.insert("trayItems", { member, pack, at, kind: "sticker", person: recipient }), kind: "sticker", person: recipient });
  const hoggie = { hoggie: drop.hoggie, rarity: drop.rarity, isNew: drop.isNew };
  items.push({ item: await ctx.db.insert("trayItems", { member, pack, at, kind: "hoggie", ...hoggie }), kind: "hoggie", ...hoggie });
  return items;
}

export function shownTrayItem(stored: Doc<"trayItems">): TrayItem {
  if (stored.kind === "sticker") return { item: stored._id, kind: "sticker", person: stored.person };
  return { item: stored._id, kind: "hoggie", hoggie: stored.hoggie, rarity: stored.rarity, isNew: stored.isNew };
}
