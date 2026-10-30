import type { QueryCtx } from "../_generated/server";
import type { DayKey } from "../engine/allowance";
import type { MemberId } from "../workspace/directory";
import { weekRowOf } from "./tallies";

export async function hoggiesFoundIn(ctx: QueryCtx, member: MemberId, week: DayKey): Promise<number> {
  const found = (await weekRowOf(ctx, member, week))?.hoggiesFound;
  return found === undefined ? 0 : found.hoggies.length + found.more;
}

export async function teammatesThankedBy(ctx: QueryCtx, member: MemberId): Promise<number> {
  const pairs = await ctx.db
    .query("pairTallies")
    .withIndex("by_member_person", (q) => q.eq("member", member))
    .collect();
  return pairs.filter(({ kudosGiven, hugsGiven }) => kudosGiven + hugsGiven > 0).length;
}

