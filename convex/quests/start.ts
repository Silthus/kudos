import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export async function startQuests(ctx: MutationCtx, member: MemberId, at: number): Promise<"started" | "already started"> {
  if ((await questStartOf(ctx, member)) !== null) return "already started";
  await ctx.db.insert("questStarts", { member, at });
  return "started";
}

export async function questStartOf(ctx: QueryCtx, member: MemberId): Promise<number | null> {
  const start = await ctx.db
    .query("questStarts")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
  return start?.at ?? null;
}
