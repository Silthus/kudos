import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export async function levelFirstReachedAt(ctx: QueryCtx, member: MemberId, level: number): Promise<number | null> {
  const reached = await ctx.db
    .query("levelUps")
    .withIndex("by_member_level", (q) => q.eq("member", member).gte("level", level))
    .first();
  return reached?.at ?? null;
}
