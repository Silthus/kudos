import { allowanceDay, weekOf, type DayKey } from "../engine/allowance";

export type WeekKey = DayKey;

const dayMs = 24 * 60 * 60 * 1000;

export function weekKeyOf(at: number, timeZone: string | undefined): WeekKey {
  return weekKeyOfDay(allowanceDay(at, timeZone));
}

export function weekKeyOfDay(day: DayKey): WeekKey {
  return weekOf(day).monday;
}

export function daysLeftInWeek(at: number, timeZone: string | undefined): number {
  const today = allowanceDay(at, timeZone);
  return (Date.parse(weekOf(today).sunday) - Date.parse(today)) / dayMs + 1;
}

export function weekStartOf(week: WeekKey, timeZone: string | undefined): number {
  const mondayInUtc = Date.parse(`${week}T00:00:00Z`);
  const firstGuess = mondayInUtc - offsetAt(mondayInUtc, timeZone);
  return mondayInUtc - offsetAt(firstGuess, timeZone);
}

function offsetAt(at: number, timeZone: string | undefined): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timeZone ?? "UTC", hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === type)!.value);
  const wallClock = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return wallClock - (at - (at % 1000));
}
