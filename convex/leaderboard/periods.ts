import { v, type Infer } from "convex/values";
import { weekOf, type DayKey } from "../engine/allowance";

export const periodValidator = v.union(v.literal("week"), v.literal("month"), v.literal("all"));

export type Period = Infer<typeof periodValidator>;

export type ComparedPeriod = Exclude<Period, "all">;

export type PeriodKey = string;

export type Days = { first: DayKey; last: DayKey };

const dayMs = 24 * 60 * 60 * 1000;

export function keysOf(day: DayKey): PeriodKey[] {
  return [keyOf("week", day), keyOf("month", day), keyOf("all", day)];
}

export function keyOf(period: Period, day: DayKey): PeriodKey {
  switch (period) {
    case "week":
      return `week:${weekOf(day).monday}`;
    case "month":
      return `month:${day.slice(0, 7)}`;
    case "all":
      return "all";
  }
}

export function lastPeriodUpToTheSameDay(period: ComparedPeriod, day: DayKey): Days {
  return period === "week" ? lastWeekUpTo(day) : lastMonthUpTo(day);
}

function lastWeekUpTo(day: DayKey): Days {
  const sameWeekdayLastWeek = dayKeyOf(Date.parse(`${day}T00:00:00Z`) - 7 * dayMs);
  return { first: weekOf(sameWeekdayLastWeek).monday, last: sameWeekdayLastWeek };
}

function lastMonthUpTo(day: DayKey): Days {
  const today = new Date(`${day}T00:00:00Z`);
  const [year, month] = [today.getUTCFullYear(), today.getUTCMonth()];
  const daysInLastMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { first: dayKeyOf(Date.UTC(year, month - 1, 1)), last: dayKeyOf(Date.UTC(year, month - 1, Math.min(today.getUTCDate(), daysInLastMonth))) };
}

function dayKeyOf(utcMidnight: number): DayKey {
  return new Date(utcMidnight).toISOString().slice(0, 10);
}
