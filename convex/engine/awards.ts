import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import type { DayKey, Week } from "./allowance";
import type { MessageRef } from "./messageEvent";
import { addToTotals } from "./totals";

export type Award = { giver: MemberId; recipient: MemberId; kudos: number };

export type WeekTotals = { givenWeek: number; receivedWeek: number };

export async function insertAwards(ctx: MutationCtx, message: MessageRef, awards: Award[], day: DayKey, at: number) {
  for (const award of awards) {
    await ctx.db.insert("awards", { ...message, ...award, day, at });
    await addToTotals(ctx, award);
  }
}

export async function weekTotals(ctx: QueryCtx, member: MemberId, week: Week): Promise<WeekTotals> {
  const given = await ctx.db
    .query("awards")
    .withIndex("by_giver", (q) => q.eq("giver", member).gte("day", week.monday).lte("day", week.sunday))
    .collect();
  const received = await ctx.db
    .query("awards")
    .withIndex("by_recipient", (q) => q.eq("recipient", member).gte("day", week.monday).lte("day", week.sunday))
    .collect();
  return { givenWeek: sumOf(given), receivedWeek: sumOf(received) };
}

function sumOf(awards: Array<{ kudos: number }>) {
  return awards.reduce((sum, award) => sum + award.kudos, 0);
}
