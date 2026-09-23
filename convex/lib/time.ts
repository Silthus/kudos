import { ConvexError, v, type Infer } from "convex/values";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar-aligned periods in the workspace timezone (ISO weeks start on Monday). */
export const periodValidator = v.union(
  v.literal("week"),
  v.literal("month"),
  v.literal("quarter"),
  v.literal("year"),
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

/** ISO 8601 week (Monday start; week 1 holds the year's first Thursday) as [weekYear, week]. */
function isoWeek(dayKey: string): [number, number] {
  const thursday = addDays(dayKey, 3 - weekdayOfKey(dayKey));
  const weekYear = Number(thursday.slice(0, 4));
  return [weekYear, Math.floor(daysBetween(`${weekYear}-01-01`, thursday) / 7) + 1];
}

export type BucketKeys = { day: string; week: string; month: string; quarter: string; year: string; all: "all" };

/**
 * Rollup bucket keys for a stored `dayKey`. Pure functions of the day key, so a revoke or rebuild
 * always lands in the bucket the original write did, even after the workspace timezone changes.
 */
export function bucketKeys(dayKey: string): BucketKeys {
  const [weekYear, week] = isoWeek(dayKey);
  const year = dayKey.slice(0, 4);
  const month = Number(dayKey.slice(5, 7));
  return {
    day: `d:${dayKey}`,
    week: `w:${weekYear}-W${pad(week)}`,
    month: `m:${dayKey.slice(0, 7)}`,
    quarter: `q:${year}-Q${Math.ceil(month / 3)}`,
    year: `y:${year}`,
    all: "all",
  };
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

/** Start of the local day after the one containing `now`: when day-, week- and period-scoped views roll over. */
export function nextDayStartUtc(now: number, timeZone: string): number {
  return startOfDayUtc(addDays(dayKeyFor(now, timeZone), 1), timeZone);
}

const LAST_DAY = "2099-12-31";

/**
 * Validate the client's current day key (YYYY-MM-DD in the workspace timezone). Reactive queries take
 * "today" from the client instead of reading the wall clock, so they re-run when the client's day rolls
 * over at midnight. The key only anchors which calendar period is shown; it grants no extra access.
 */
export function parseToday(value: string): string {
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= EPOCH_DAY &&
    value <= LAST_DAY &&
    addDays(value, 0) === value; // rejects 2026-02-30 and friends
  if (!valid) throw new ConvexError(`\`today\` must be a day key (YYYY-MM-DD) between ${EPOCH_DAY} and ${LAST_DAY}.`);
  return value;
}

export type DayRange = { start: string; end: string; days: number };
export type PeriodRange = {
  period: Period;
  label: string;
  /** Bucket key of the period containing `today` (see `bucketKeys`). */
  bucket: string;
  /** From the start of the bucket through `today`. */
  current: DayRange;
  /** The whole current bucket, including days still to come. */
  currentFull: DayRange;
  previousBucket: string | null;
  /** The whole previous bucket: per-member values, ranks and rank changes compare with this. */
  previous: DayRange | null;
  /** The previous bucket up to the same day offset as `today`: workspace KPIs compare with this. */
  previousToDate: DayRange | null;
};

/** The first day the app ever looks at; "all time" starts here. */
export const EPOCH_DAY = "2000-01-01";

function range(start: string, end: string): DayRange {
  return { start, end, days: daysBetween(start, end) + 1 };
}

/** First day of the week/month/quarter/year bucket containing `dayKey`. */
function bucketStart(period: Exclude<Period, "all">, dayKey: string): string {
  switch (period) {
    case "week":
      return addDays(dayKey, -weekdayOfKey(dayKey));
    case "month":
      return `${dayKey.slice(0, 7)}-01`;
    case "quarter": {
      const firstMonth = Math.floor((Number(dayKey.slice(5, 7)) - 1) / 3) * 3 + 1;
      return `${dayKey.slice(0, 4)}-${pad(firstMonth)}-01`;
    }
    case "year":
      return `${dayKey.slice(0, 4)}-01-01`;
  }
}

/** First day of the bucket after the one starting at `start`. */
function nextBucketStart(period: Exclude<Period, "all">, start: string): string {
  if (period === "week") return addDays(start, 7);
  const [y, m] = start.split("-").map(Number);
  const months = period === "month" ? 1 : period === "quarter" ? 3 : 12;
  const next = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-01`;
}

const LABELS: Record<Period, string> = {
  week: "This week",
  month: "This month",
  quarter: "This quarter",
  year: "This year",
  all: "All time",
};

/**
 * Resolve a calendar-aligned period around `today` (a day key in the workspace timezone):
 * the current bucket to date and in full, and the previous bucket in full and to date.
 */
export function resolvePeriod(period: Period, today: string): PeriodRange {
  const label = LABELS[period];
  if (period === "all") {
    return {
      period,
      label,
      bucket: "all",
      current: range(EPOCH_DAY, today),
      currentFull: range(EPOCH_DAY, today),
      previousBucket: null,
      previous: null,
      previousToDate: null,
    };
  }
  const start = bucketStart(period, today);
  const prevEnd = addDays(start, -1);
  const prevStart = bucketStart(period, prevEnd);
  const offset = daysBetween(start, today);
  const prevToDateEnd = addDays(prevStart, offset) < prevEnd ? addDays(prevStart, offset) : prevEnd;
  return {
    period,
    label,
    bucket: bucketKeys(today)[period],
    current: range(start, today),
    currentFull: range(start, addDays(nextBucketStart(period, start), -1)),
    previousBucket: bucketKeys(prevStart)[period],
    previous: range(prevStart, prevEnd),
    previousToDate: range(prevStart, prevToDateEnd),
  };
}

export function eachDay(r: DayRange): string[] {
  const out: string[] = [];
  for (let i = 0; i < r.days; i++) out.push(addDays(r.start, i));
  return out;
}
