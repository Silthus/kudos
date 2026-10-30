import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { allowanceDay, type DayKey } from "../engine/allowance";
import type { AwardId } from "../engine/awards";
import type { MessageRef } from "../engine/messageEvent";
import { timeZoneOf, type MemberId } from "../workspace/directory";
import { dayOfPeriod, keyOf, periods, type Period, type PeriodKey } from "./periods";
import { withKudosOn } from "./runningTotal";

export type RecognitionCounts = { kudosGiven: number; kudosReceived: number; hugsGiven: number; hugsReceived: number };

export type PeriodTotals = RecognitionCounts & { firstDay: DayKey | null };

export type MemberTotals = PeriodTotals & { member: MemberId };

export type Landing = { workspace: string; member: MemberId; day: DayKey };

type Added = Partial<RecognitionCounts>;

type Counted = Doc<"givenByDay"> | Doc<"givenTotals">;

type Total = Doc<"givenTotals">;

const keptBesideKudosGiven = ["kudosReceived", "hugsGiven", "hugsReceived"] as const;

const weekKeys = { from: "week:", to: "week;" };

export const countedKeys = {
  kudosReceived: (award: AwardId) => `kudos-received:${award}`,
  hugGiven: (giver: MemberId, { conversation, message }: MessageRef) => `hug-given:${giver}:${conversation}:${message}`,
  hugReceived: (person: MemberId, giver: MemberId, { conversation, message }: MessageRef) => `hug-received:${person}:${giver}:${conversation}:${message}`,
};

export async function countOnce(ctx: MutationCtx, workspace: string, key: string): Promise<boolean> {
  const counted = await ctx.db
    .query("countedRecognitions")
    .withIndex("by_key", (q) => q.eq("workspace", workspace).eq("key", key))
    .unique();
  if (counted !== null) return false;
  await ctx.db.insert("countedRecognitions", { workspace, key });
  return true;
}

export async function landingAt(ctx: QueryCtx, workspace: string, member: MemberId, at: number): Promise<Landing> {
  return { workspace, member, day: allowanceDay(at, (await timeZoneOf(ctx, member)) ?? undefined) };
}

export async function addCounts(ctx: MutationCtx, landing: Landing, added: Added) {
  await addToDay(ctx, landing, added);
  for (const period of periods) await addToPeriod(ctx, landing, period, added);
}

export async function noteGivingDay(ctx: MutationCtx, { member, day }: Landing) {
  for (const period of periods) {
    const row = await periodRowOf(ctx, member, keyOf(period, day));
    if (row !== null && !(row.firstDay !== undefined && row.firstDay <= day)) await ctx.db.patch(row._id, { firstDay: day });
  }
}

export async function totalsOf(ctx: QueryCtx, member: MemberId, period: PeriodKey): Promise<PeriodTotals> {
  return periodTotalsOf(await periodRowOf(ctx, member, period));
}

export async function firstCountedWeekOf(ctx: QueryCtx, member: MemberId): Promise<DayKey | null> {
  const first = await ctx.db
    .query("givenTotals")
    .withIndex("by_member_period", (q) => q.eq("member", member).gte("period", weekKeys.from).lt("period", weekKeys.to))
    .first();
  return first === null ? null : first.period.slice(weekKeys.from.length);
}

export async function weekCountsBetween(ctx: QueryCtx, member: MemberId, oldest: DayKey, newest: DayKey): Promise<Map<DayKey, RecognitionCounts>> {
  const rows = await ctx.db
    .query("givenTotals")
    .withIndex("by_member_period", (q) => q.eq("member", member).gte("period", keyOf("week", oldest)).lte("period", keyOf("week", newest)))
    .collect();
  return countsByWeek(rows);
}

export async function weekCountsThrough(ctx: QueryCtx, member: MemberId, newest: DayKey): Promise<Map<DayKey, RecognitionCounts>> {
  const rows = await ctx.db
    .query("givenTotals")
    .withIndex("by_member_period", (q) => q.eq("member", member).gte("period", weekKeys.from).lte("period", keyOf("week", newest)))
    .collect();
  return countsByWeek(rows);
}

export async function totalsIn(ctx: QueryCtx, workspace: string, period: PeriodKey): Promise<MemberTotals[]> {
  const rows = await ctx.db
    .query("givenTotals")
    .withIndex("by_period", (q) => q.eq("workspace", workspace).eq("period", period))
    .collect();
  return rows.map((row) => ({ member: row.member, ...periodTotalsOf(row) }));
}

function countsByWeek(rows: Total[]): Map<DayKey, RecognitionCounts> {
  return new Map(rows.map((row) => [row.period.slice(weekKeys.from.length), countsOf(row)]));
}

function periodTotalsOf(row: Total | null): PeriodTotals {
  return { ...countsOf(row), firstDay: row?.firstDay ?? null };
}

function countsOf(row: Counted | null): RecognitionCounts {
  return { kudosGiven: row?.kudos ?? 0, kudosReceived: row?.kudosReceived ?? 0, hugsGiven: row?.hugsGiven ?? 0, hugsReceived: row?.hugsReceived ?? 0 };
}

function withAdded(row: Counted | null, added: Added) {
  const sums: Partial<Pick<Counted, (typeof keptBesideKudosGiven)[number]>> = {};
  for (const field of keptBesideKudosGiven) if (added[field] !== undefined) sums[field] = (row?.[field] ?? 0) + added[field];
  return { kudos: (row?.kudos ?? 0) + (added.kudosGiven ?? 0), ...sums };
}

async function addToDay(ctx: MutationCtx, { workspace, member, day }: Landing, added: Added) {
  const row = await ctx.db
    .query("givenByDay")
    .withIndex("by_member_day", (q) => q.eq("member", member).eq("day", day))
    .unique();
  if (row === null) await ctx.db.insert("givenByDay", { workspace, member, day, ...withAdded(null, added) });
  else await ctx.db.patch(row._id, withAdded(row, added));
}

async function addToPeriod(ctx: MutationCtx, { workspace, member, day }: Landing, period: Period, added: Added) {
  const key = keyOf(period, day);
  const row = await periodRowOf(ctx, member, key);
  const counts = { ...withAdded(row, added), ...firstDayAdding(row, day, added), ...runningTotalAdding(period, row, day, added.kudosGiven ?? 0) };
  if (row === null) await ctx.db.insert("givenTotals", { workspace, member, period: key, ...counts });
  else await ctx.db.patch(row._id, counts);
}

function periodRowOf(ctx: QueryCtx, member: MemberId, period: PeriodKey) {
  return ctx.db
    .query("givenTotals")
    .withIndex("by_member_period", (q) => q.eq("member", member).eq("period", period))
    .unique();
}

function firstDayAdding(row: Total | null, day: DayKey, { kudosGiven = 0, hugsGiven = 0 }: Added) {
  if (kudosGiven + hugsGiven === 0) return {};
  const firstDay = row?.firstDay;
  return { firstDay: firstDay !== undefined && firstDay < day ? firstDay : day };
}

function runningTotalAdding(period: Period, row: Total | null, day: DayKey, kudos: number) {
  if (period === "all" || (row !== null && kudos === 0)) return {};
  const runningTotal = row === null ? [] : row.runningTotal;
  return runningTotal === undefined ? {} : { runningTotal: withKudosOn(runningTotal, dayOfPeriod(period, day), kudos) };
}
