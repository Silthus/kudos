import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export async function levelFirstReachedAt(ctx: QueryCtx, member: MemberId, level: number): Promise<number | null> {
  const reached = await ctx.db
    .query("levelUps")
    .withIndex("by_member_level", (q) => q.eq("member", member).gte("level", level))
    .first();
  return reached?.at ?? null;
}

export async function levelUpAt(ctx: QueryCtx, member: MemberId, level: number): Promise<number | null> {
  return (await levelUpRowOf(ctx, member, level))?.at ?? null;
}

export async function levelUpRecordedAt(ctx: QueryCtx, member: MemberId, level: number): Promise<number | null> {
  return (await levelUpRowOf(ctx, member, level))?._creationTime ?? null;
}

function levelUpRowOf(ctx: QueryCtx, member: MemberId, level: number) {
  return ctx.db
    .query("levelUps")
    .withIndex("by_member_level", (q) => q.eq("member", member).eq("level", level))
    .first();
}

export async function levelUpBefore(ctx: QueryCtx, member: MemberId, level: number): Promise<number> {
  const previous = await ctx.db
    .query("levelUps")
    .withIndex("by_member_level", (q) => q.eq("member", member).lt("level", level))
    .order("desc")
    .first();
  return previous?.level ?? 1;
}
