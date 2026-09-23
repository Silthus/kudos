import { v, type Infer } from "convex/values";

export const DAY_MS = 24 * 60 * 60 * 1000;

export const periodValidator = v.union(
  v.literal("week"),
  v.literal("7d"),
  v.literal("30d"),
  v.literal("month"),
  v.literal("90d"),
  v.literal("all"),
);
export type Period = Infer<typeof periodValidator>;

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  let f = partsFormatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    });
    partsFormatterCache.set(timeZone, f);
  }
  return f;
}

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Monday … 6 = Sunday
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function zonedParts(ts: number, timeZone: string): ZonedParts {
  const out: Record<string, string> = {};
  for (const p of formatter(timeZone).formatToParts(new Date(ts))) {
    out[p.type] = p.value;
  }
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: WEEKDAYS.indexOf(out.weekday),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function dayKeyFor(ts: number, timeZone: string): string {
  const p = zonedParts(ts, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Calendar arithmetic on YYYY-MM-DD keys; timezone independent. */
export function addDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * DAY_MS;
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function daysBetween(fromKey: string, toKey: string): number {
  const [y1, m1, d1] = fromKey.split("-").map(Number);
  const [y2, m2, d2] = toKey.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayOfKey(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** UTC timestamp of local midnight at the start of `dayKey` in `timeZone`. */
export function startOfDayUtc(dayKey: string, timeZone: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let ts = guess;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(ts, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    ts = ts - (asUtc - guess);
  }
  if (dayKeyFor(ts, timeZone) === dayKey && dayKeyFor(ts - 1, timeZone) < dayKey) return ts;
  // Midnight doesn't exist (or exists twice) when a DST switch happens at 00:00:
  // binary-search the first instant whose local day is `dayKey`.
  let lo = ts - 3 * 3_600_000; // before the day
  let hi = ts + 3 * 3_600_000; // inside the day
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (dayKeyFor(mid, timeZone) < dayKey) lo = mid;
    else hi = mid;
  }
  return hi;
}

export type DayRange = { start: string; end: string; days: number };
export type PeriodRange = {
  period: Period;
  current: DayRange;
  previous: DayRange | null;
  label: string;
};

function range(start: string, end: string): DayRange {
  return { start, end, days: daysBetween(start, end) + 1 };
}

/** Resolve a named period to inclusive day ranges, plus the equal-length period before it. */
export function resolvePeriod(period: Period, now: number, timeZone: string): PeriodRange {
  const today = dayKeyFor(now, timeZone);
  let current: DayRange;
  let label: string;
  switch (period) {
    case "week": {
      const start = addDays(today, -weekdayOfKey(today));
      current = range(start, today);
      label = "This week";
      break;
    }
    case "month": {
      current = range(`${today.slice(0, 8)}01`, today);
      label = "This month";
      break;
    }
    case "7d":
      current = range(addDays(today, -6), today);
      label = "Last 7 days";
      break;
    case "30d":
      current = range(addDays(today, -29), today);
      label = "Last 30 days";
      break;
    case "90d":
      current = range(addDays(today, -89), today);
      label = "Last 90 days";
      break;
    case "all":
      return { period, current: range("2000-01-01", today), previous: null, label: "All time" };
  }
  const prevEnd = addDays(current.start, -1);
  const previous = range(addDays(prevEnd, -(current.days - 1)), prevEnd);
  return { period, current, previous, label };
}

export function eachDay(r: DayRange): string[] {
  const out: string[] = [];
  for (let i = 0; i < r.days; i++) out.push(addDays(r.start, i));
  return out;
}
