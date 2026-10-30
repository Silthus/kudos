import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { DayKey } from "../engine/allowance";
import type { MemberId } from "../workspace/directory";
import { dayOfPeriod, keyOf, type ComparedPeriod, type PeriodKey } from "./periods";
import { withKudosOn, type RunningTotal } from "./runningTotal";

export type HugsCounted = { workspace: string; member: MemberId; day: DayKey; hugsBefore: number; hugs: number };

export type PeriodOfMember = { workspace: string; member: MemberId; period: PeriodKey };

export async function addHugsToRunningTotal(ctx: MutationCtx, period: ComparedPeriod, { workspace, member, day, hugsBefore, hugs }: HugsCounted) {
  const key = keyOf(period, day);
  const row = await runningTotalRowOf(ctx, member, key);
  if (row === null && hugsBefore > 0) return;
  const runningTotal = withKudosOn(row?.runningTotal ?? [], dayOfPeriod(period, day), hugs);
  if (row === null) await ctx.db.insert("hugRunningTotals", { workspace, member, period: key, runningTotal });
  else await ctx.db.patch(row._id, { runningTotal });
}

export async function hugRunningTotalsIn(ctx: QueryCtx, workspace: string, period: PeriodKey): Promise<Map<MemberId, RunningTotal>> {
  const rows = await ctx.db
    .query("hugRunningTotals")
    .withIndex("by_period", (q) => q.eq("workspace", workspace).eq("period", period))
    .collect();
  return new Map(rows.map(({ member, runningTotal }) => [member, runningTotal]));
}

export async function hugRunningTotalOf(ctx: QueryCtx, member: MemberId, period: PeriodKey): Promise<RunningTotal | null> {
  return (await runningTotalRowOf(ctx, member, period))?.runningTotal ?? null;
}

export async function recordHugRunningTotal(ctx: MutationCtx, { workspace, member, period }: PeriodOfMember, runningTotal: RunningTotal) {
  const row = await runningTotalRowOf(ctx, member, period);
  if (row === null) await ctx.db.insert("hugRunningTotals", { workspace, member, period, runningTotal });
  else await ctx.db.patch(row._id, { runningTotal });
}

function runningTotalRowOf(ctx: QueryCtx, member: MemberId, period: PeriodKey) {
  return ctx.db
    .query("hugRunningTotals")
    .withIndex("by_member_period", (q) => q.eq("member", member).eq("period", period))
    .unique();
}
