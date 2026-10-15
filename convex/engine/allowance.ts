import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export type DayKey = string;

export type Week = { monday: DayKey; sunday: DayKey };

export type DailyAllowance = { opening: number; left: number; spend(kudos: number): Promise<void> };

const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;

export function allowanceDay(at: number, timeZone: string | undefined): DayKey {
  return new Intl.DateTimeFormat("en-CA", { timeZone: dayZoneOf(timeZone) }).format(at);
}

export function dayZoneOf(timeZone: string | undefined): string {
  return timeZone ?? "UTC";
}

export function nextAllowanceDayStart(at: number, timeZone: string | undefined) {
  const today = allowanceDay(at, timeZone);
  let stillToday = at;
  let tomorrow = at + 2 * dayMs;
  while (tomorrow - stillToday > 1) {
    const middle = Math.floor((stillToday + tomorrow) / 2);
    if (allowanceDay(middle, timeZone) === today) stillToday = middle;
    else tomorrow = middle;
  }
  return tomorrow;
}

export function wallClockAt(day: DayKey, hour: number, timeZone: string | undefined): number {
  const asIfUtc = Date.parse(`${day}T00:00:00Z`) + hour * hourMs;
  const firstGuess = asIfUtc - offsetAt(asIfUtc, timeZone);
  return asIfUtc - offsetAt(firstGuess, timeZone);
}

function offsetAt(at: number, timeZone: string | undefined): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: dayZoneOf(timeZone), hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === type)!.value);
  const wallClock = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return wallClock - (at - (at % 1000));
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
