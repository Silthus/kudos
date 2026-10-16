import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { DayKey } from "../engine/allowance";
import type { MessageRef } from "../engine/messageEvent";
import type { MemberId } from "../workspace/directory";

export type Star = Doc<"stars">;

export type StarFor = { onKudos: true } | { onKudos: false; author: MemberId };

export function starOf(ctx: QueryCtx, { workspace, conversation, message }: MessageRef, giver: MemberId) {
  return ctx.db
    .query("stars")
    .withIndex("by_message_giver", (q) => q.eq("workspace", workspace).eq("conversation", conversation).eq("message", message).eq("giver", giver))
    .unique();
}

export async function starsGivenOn(ctx: QueryCtx, giver: MemberId, day: DayKey, atMost: number): Promise<number> {
  const given = await ctx.db
    .query("stars")
    .withIndex("by_giver_day", (q) => q.eq("giver", giver).eq("day", day))
    .take(atMost);
  return given.length;
}

export async function insertStar(ctx: MutationCtx, star: MessageRef & StarFor & { giver: MemberId; at: number; day: DayKey }) {
  await ctx.db.insert("stars", star);
}

export async function isPaid(ctx: QueryCtx, star: Star, member: MemberId): Promise<boolean> {
  const paid = await ctx.db
    .query("starPeople")
    .withIndex("by_star_member", (q) => q.eq("star", star._id).eq("member", member))
    .unique();
  return paid !== null;
}

export async function insertPaid(ctx: MutationCtx, star: Star, member: MemberId) {
  await ctx.db.insert("starPeople", { star: star._id, member, at: star.at });
}
