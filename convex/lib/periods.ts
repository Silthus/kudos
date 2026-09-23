import { ALL_BUCKET, monthBucket, quarterBucket, weekBucket, yearBucket } from "./buckets";
import { addDays, daysBetween, EPOCH_DAY, weekdayOfKey, type DayRange, type Period } from "./time";

export type PeriodRange = {
  period: Period;
  label: string;
  /** Rollup bucket key of the period containing `today` (see `lib/buckets.ts`). */
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

type CalendarPeriod = Exclude<Period, "all">;

const pad = (n: number) => String(n).padStart(2, "0");

function range(start: string, end: string): DayRange {
  return { start, end, days: daysBetween(start, end) + 1 };
}

const BUCKET_OF: Record<CalendarPeriod, (dayKey: string) => string> = {
  week: weekBucket,
  month: monthBucket,
  quarter: quarterBucket,
  year: yearBucket,
};

/** First day of the week/month/quarter/year bucket containing `dayKey`. */
function bucketStart(period: CalendarPeriod, dayKey: string): string {
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
function nextBucketStart(period: CalendarPeriod, start: string): string {
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
      bucket: ALL_BUCKET,
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
  const sameOffset = addDays(prevStart, daysBetween(start, today));
  return {
    period,
    label,
    bucket: BUCKET_OF[period](today),
    current: range(start, today),
    currentFull: range(start, addDays(nextBucketStart(period, start), -1)),
    previousBucket: BUCKET_OF[period](prevStart),
    previous: range(prevStart, prevEnd),
    previousToDate: range(prevStart, sameOffset < prevEnd ? sameOffset : prevEnd),
  };
}
