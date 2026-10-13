import { allowanceDay, weekOf, type DayKey } from "../engine/allowance";

export type WeekKey = DayKey;

const dayMs = 24 * 60 * 60 * 1000;

export function weekKeyOf(at: number, timeZone: string | undefined): WeekKey {
  return weekOf(allowanceDay(at, timeZone)).monday;
}

export function daysLeftInWeek(at: number, timeZone: string | undefined): number {
  const today = allowanceDay(at, timeZone);
  return (Date.parse(weekOf(today).sunday) - Date.parse(today)) / dayMs + 1;
}
