import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { KudosGivenEvent } from "../bus/events";
import { allowanceDay, weekOf, type DayKey } from "../engine/allowance";
import type { MemberId } from "../workspace/directory";
import { catalogue } from "./catalogue";
import { gateDecisionOf } from "./gate";
import { noReceiving, type EffectsRecord, type Receiving } from "./progress";

export type ReceivingWeek = Receiving & { recipient: MemberId; week: DayKey };

export async function receivingWeekOf(ctx: QueryCtx, { giver, at, annotations }: KudosGivenEvent, member: MemberId): Promise<ReceivingWeek | null> {
  if (member === giver || gateDecisionOf(annotations)?.thoughtful !== true) return null;
  const recipient = await ctx.db.get(member);
  const timeZone = recipient?.kind === "member" ? recipient.timeZone : undefined;
  const week = weekOf(allowanceDay(at, timeZone)).monday;
  const paid = await ctx.db
    .query("receivingGivers")
    .withIndex("by_recipient_week", (q) => q.eq("recipient", member).eq("week", week))
    .take(catalogue.coins.receivingGiversAWeek);
  return { recipient: member, week, paidBy: paid.map(({ giver }) => giver) };
}

export function receivingOf(week: ReceivingWeek | null): Receiving {
  return week === null ? noReceiving : { paidBy: week.paidBy };
}

export async function recordReceiving(ctx: MutationCtx, week: ReceivingWeek | null, giver: MemberId, effects: EffectsRecord[]) {
  if (week === null || !effects.some(({ coins = [] }) => coins.some(({ source }) => source === "receiving"))) return;
  await ctx.db.insert("receivingGivers", { recipient: week.recipient, week: week.week, giver });
}
