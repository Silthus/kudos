import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export type DayKey = string;

export type Week = { monday: DayKey; sunday: DayKey };

export type DailyAllowance = { opening: number; left: number; spend(kudos: number): Promise<void> };

const dayMs = 24 * 60 * 60 * 1000;

export function allowanceDay(at: number, timeZone: string | undefined): DayKey {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timeZone ?? "UTC" }).format(at);
}

export function weekOf(day: DayKey): Week {
  const date = Date.parse(`${day}T00:00:00Z`);
  const daysSinceMonday = (new Date(date).getUTCDay() + 6) % 7;
  const monday = date - daysSinceMonday * dayMs;
  return { monday: dayKeyOf(monday), sunday: dayKeyOf(monday + 6 * dayMs) };
}

export async function allowanceLeft(ctx: QueryCtx, giver: MemberId, day: DayKey, base: number) {
  const spending = await spendingOn(ctx, giver, day);
  return leftOf(base, spending?.spent ?? 0);
}

export async function dailyAllowance(ctx: MutationCtx, giver: MemberId, day: DayKey, base: number): Promise<DailyAllowance> {
  const spending = await spendingOn(ctx, giver, day);
  const spent = spending?.spent ?? 0;
  return {
    opening: base,
    left: leftOf(base, spent),
    async spend(kudos) {
      if (spending === null) await ctx.db.insert("allowanceSpending", { giver, day, spent: kudos });
      else await ctx.db.patch(spending._id, { spent: spent + kudos });
    },
  };
}

function leftOf(base: number, spent: number) {
  return Math.max(0, base - spent);
}

function spendingOn(ctx: QueryCtx, giver: MemberId, day: DayKey) {
  return ctx.db
    .query("allowanceSpending")
    .withIndex("by_giver_day", (q) => q.eq("giver", giver).eq("day", day))
    .unique();
}

function dayKeyOf(utcMidnight: number): DayKey {
  return new Date(utcMidnight).toISOString().slice(0, 10);
}
