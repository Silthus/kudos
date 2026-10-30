import type { MutationCtx, QueryCtx } from "../_generated/server";
import { weekOf, type DayKey } from "../engine/allowance";
import type { MemberId } from "../workspace/directory";
import type { Landing } from "./counts";

export async function noteThanker(ctx: MutationCtx, { member, day }: Landing, thanker: MemberId) {
  const week = weekOf(day).monday;
  if (!(await wasNoted(ctx, member, week, thanker))) await ctx.db.insert("weekThankers", { member, week, person: thanker });
}

export async function teammatesWhoThanked(ctx: QueryCtx, member: MemberId, week: DayKey): Promise<number> {
  const thankers = await ctx.db
    .query("weekThankers")
    .withIndex("by_member_week_person", (q) => q.eq("member", member).eq("week", week))
    .collect();
  return thankers.length;
}

async function wasNoted(ctx: QueryCtx, member: MemberId, week: DayKey, thanker: MemberId) {
  const noted = await ctx.db
    .query("weekThankers")
    .withIndex("by_member_week_person", (q) => q.eq("member", member).eq("week", week).eq("person", thanker))
    .unique();
  return noted !== null;
}
