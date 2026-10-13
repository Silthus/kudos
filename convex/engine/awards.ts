import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import type { DayKey, Week } from "./allowance";
import type { MessageRef } from "./messageEvent";

export type Award = { giver: MemberId; recipient: MemberId; kudos: number };

export type KudosTotals = { givenWeek: number; receivedWeek: number; given: number; received: number };

export async function insertAwards(ctx: MutationCtx, message: MessageRef, awards: Award[], day: DayKey, at: number) {
  for (const award of awards) {
    await ctx.db.insert("awards", { ...message, ...award, day, at });
  }
}

export async function kudosTotals(ctx: QueryCtx, member: MemberId, week: Week): Promise<KudosTotals> {
  const given = await ctx.db
    .query("awards")
    .withIndex("by_giver", (q) => q.eq("giver", member))
    .collect();
  const received = await ctx.db
    .query("awards")
    .withIndex("by_recipient", (q) => q.eq("recipient", member))
    .collect();
  const inWeek = ({ day }: { day: DayKey }) => week.monday <= day && day <= week.sunday;
  return {
    givenWeek: sumOf(given.filter(inWeek)),
    receivedWeek: sumOf(received.filter(inWeek)),
    given: sumOf(given),
    received: sumOf(received),
  };
}

function sumOf(awards: Array<{ kudos: number }>) {
  return awards.reduce((sum, award) => sum + award.kudos, 0);
}
