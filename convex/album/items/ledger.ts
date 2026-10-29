import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { DmLinks } from "../../feedback/dmLinks";
import type { MemberId } from "../../workspace/directory";
import { achievementHoggiesShownTo, isAnAchievement } from "./achievementFlag";
import { hiddenItemsShownTo } from "./flag";
import type { Earning, ItemReason, ItemSource } from "./records";

export const mostItemsShown = 100;

export const mostWaitingCounted = 50;

export type FaceDown = { item: Id<"items">; earnedAt: number; reason: ItemReason };

export type WaitingCount = number | `${typeof mostWaitingCounted}+`;

export async function earnItem(ctx: MutationCtx, earning: Earning): Promise<Id<"items">> {
  const earned = await itemOf(ctx, earning.member, earning.source, earning.key);
  return earned?._id ?? (await ctx.db.insert("items", earning));
}

export async function markTurned(ctx: MutationCtx, member: MemberId, source: ItemSource, key: string, at: number): Promise<void> {
  const earned = await itemOf(ctx, member, source, key);
  if (earned !== null && earned.turnedAt === undefined) await ctx.db.patch(earned._id, { turnedAt: at });
}

export async function boardOf(ctx: QueryCtx, member: MemberId): Promise<{ items: FaceDown[]; more: boolean }> {
  const oldestFirst = await waitingOf(ctx, member, mostItemsShown + 1);
  return { items: oldestFirst.slice(0, mostItemsShown).map(faceDown), more: oldestFirst.length > mostItemsShown };
}

export async function waitingCountOf(ctx: QueryCtx, member: MemberId): Promise<WaitingCount> {
  const { length } = await waitingOf(ctx, member, mostWaitingCounted + 1);
  return length > mostWaitingCounted ? `${mostWaitingCounted}+` : length;
}

export async function shownWaitingHoggiesOf(ctx: QueryCtx, member: MemberId, links: DmLinks | null): Promise<WaitingCount> {
  if (links === null || !(await hiddenItemsShownTo(ctx, member))) return 0;
  return waitingHoggieCountOf(ctx, member);
}

async function waitingHoggieCountOf(ctx: QueryCtx, member: MemberId): Promise<WaitingCount> {
  const hoggies = (await waitingOf(ctx, member, mostItemsShown + 1)).filter(({ source }) => source === "hoggie").length;
  return hoggies > mostWaitingCounted ? `${mostWaitingCounted}+` : hoggies;
}

export async function stickerWaitsFor(ctx: QueryCtx, member: MemberId, person: MemberId): Promise<boolean> {
  const waiting = await waitingOf(ctx, member, mostItemsShown + 1);
  return waiting.some(({ source, reason }) => source === "sticker" && reason.kind === "thanks" && reason.person === person);
}

async function waitingOf(ctx: QueryCtx, member: MemberId, most: number): Promise<Doc<"items">[]> {
  const achievementsShown = await achievementHoggiesShownTo(ctx, member);
  const waiting: Doc<"items">[] = [];
  const oldestFirst = ctx.db.query("items").withIndex("by_member_turned", (q) => q.eq("member", member).eq("turnedAt", undefined));
  for await (const item of oldestFirst) {
    if (achievementsShown || !isAnAchievement(item.reason)) waiting.push(item);
    if (waiting.length === most) break;
  }
  return waiting;
}

export function waitingPageOf(ctx: QueryCtx, member: MemberId, cursor: string | null, numItems: number) {
  return ctx.db
    .query("items")
    .withIndex("by_member_turned", (q) => q.eq("member", member).eq("turnedAt", undefined))
    .paginate({ cursor, numItems });
}

function faceDown({ _id, earnedAt, reason }: Doc<"items">): FaceDown {
  return { item: _id, earnedAt, reason };
}

export async function newestTurnOf(ctx: QueryCtx, member: MemberId): Promise<number | null> {
  const newest = await ctx.db
    .query("items")
    .withIndex("by_member_turned", (q) => q.eq("member", member))
    .order("desc")
    .first();
  return newest?.turnedAt ?? null;
}

export async function isWaiting(ctx: QueryCtx, member: MemberId, source: ItemSource, key: string): Promise<boolean> {
  const item = await itemOf(ctx, member, source, key);
  return item !== null && item.turnedAt === undefined;
}

export async function isTurned(ctx: QueryCtx, member: MemberId, source: ItemSource, key: string): Promise<boolean> {
  return (await itemOf(ctx, member, source, key))?.turnedAt !== undefined;
}

export function earnedItemOf(ctx: QueryCtx, member: MemberId, source: ItemSource, key: string): Promise<Doc<"items"> | null> {
  return itemOf(ctx, member, source, key);
}

function itemOf(ctx: QueryCtx, member: MemberId, source: ItemSource, key: string): Promise<Doc<"items"> | null> {
  return ctx.db
    .query("items")
    .withIndex("by_member_source_key", (q) => q.eq("member", member).eq("source", source).eq("key", key))
    .unique();
}
