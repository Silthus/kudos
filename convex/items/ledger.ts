import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
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

function waitingOf(ctx: QueryCtx, member: MemberId, most: number): Promise<Doc<"items">[]> {
  return ctx.db
    .query("items")
    .withIndex("by_member_turned", (q) => q.eq("member", member).eq("turnedAt", undefined))
    .take(most);
}

function faceDown({ _id, earnedAt, reason }: Doc<"items">): FaceDown {
  return { item: _id, earnedAt, reason };
}

export async function isTurned(ctx: QueryCtx, member: MemberId, source: ItemSource, key: string): Promise<boolean> {
  return (await itemOf(ctx, member, source, key))?.turnedAt !== undefined;
}

function itemOf(ctx: QueryCtx, member: MemberId, source: ItemSource, key: string): Promise<Doc<"items"> | null> {
  return ctx.db
    .query("items")
    .withIndex("by_member_source_key", (q) => q.eq("member", member).eq("source", source).eq("key", key))
    .unique();
}
