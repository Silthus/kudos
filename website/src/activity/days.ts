const day = 24 * 60 * 60 * 1000;

export function zoneOf(timeZone: string | null): string | undefined {
  if (timeZone === null) return undefined;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
}

type CalendarDay = { year: number; month: number; date: number };

function calendarDayOf(at: number, timeZone: string | undefined): CalendarDay {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((each) => each.type === type)?.value);
  return { year: part("year"), month: part("month"), date: part("day") };
}

export function dayKeyOf(at: number, timeZone: string | undefined) {
  const { year, month, date } = calendarDayOf(at, timeZone);
  return `${year}-${month}-${date}`;
}

function dayBefore({ year, month, date }: CalendarDay) {
  const before = new Date(Date.UTC(year, month - 1, date) - day);
  return `${before.getUTCFullYear()}-${before.getUTCMonth() + 1}-${before.getUTCDate()}`;
}

export function dayHeadingOf(at: number, now: number, timeZone: string | undefined) {
  const today = calendarDayOf(now, timeZone);
  const key = dayKeyOf(at, timeZone);
  if (key === `${today.year}-${today.month}-${today.date}`) return "Today";
  if (key === dayBefore(today)) return "Yesterday";
  const thisYear = calendarDayOf(at, timeZone).year === today.year;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", day: "numeric", month: "short", year: thisYear ? undefined : "numeric" }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((each) => each.type === type)?.value;
  return [`${part("weekday")}, ${part("day")} ${part("month")}`, part("year")].filter(Boolean).join(" ");
}

export function timeOf(at: number, timeZone: string | undefined) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}
