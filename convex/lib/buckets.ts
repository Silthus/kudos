import { addDays, weekdayOfKey } from "./time";

/**
 * Rollup bucket keys. Every key is a pure function of a stored `dayKey` (the workspace-local
 * day at write time), so a revoke or rebuild always lands in the bucket the give went to,
 * even after the workspace timezone changes.
 *
 *   d:2026-09-23   day
 *   w:2026-W39     ISO week (Monday start, belongs to the year of its Thursday)
 *   m:2026-09      month
 *   q:2026-Q3      quarter
 *   y:2026         year
 *   all            all time
 */
export const ALL_BUCKET = "all";

const pad = (n: number) => String(n).padStart(2, "0");

export function dayBucket(dayKey: string) {
  return `d:${dayKey}`;
}

export function weekBucket(dayKey: string) {
  const thursday = addDays(dayKey, 3 - weekdayOfKey(dayKey));
  const year = thursday.slice(0, 4);
  const [y, m, d] = thursday.split("-").map(Number);
  const dayOfYear = (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000;
  return `w:${year}-W${pad(Math.floor(dayOfYear / 7) + 1)}`;
}

export function monthBucket(dayKey: string) {
  return `m:${dayKey.slice(0, 7)}`;
}

export function quarterBucket(dayKey: string) {
  return `q:${dayKey.slice(0, 4)}-Q${Math.floor((Number(dayKey.slice(5, 7)) - 1) / 3) + 1}`;
}

export function yearBucket(dayKey: string) {
  return `y:${dayKey.slice(0, 4)}`;
}

/** `memberStats` buckets: the day lives in `memberDays`, all time in `members.total*`. */
export function memberBuckets(dayKey: string) {
  return [weekBucket(dayKey), monthBucket(dayKey), quarterBucket(dayKey), yearBucket(dayKey)];
}

/** `pairStats` / `channelStats` buckets. */
export function pairBuckets(dayKey: string) {
  return [...memberBuckets(dayKey), ALL_BUCKET];
}

/** `workspaceStats` buckets. */
export function workspaceBuckets(dayKey: string) {
  return [dayBucket(dayKey), ...pairBuckets(dayKey)];
}

/** Day buckets keep 24 hourly cells; every longer bucket a weekday-major 7 × 24 grid. */
export function heatSize(bucket: string) {
  return bucket.startsWith("d:") ? 24 : 7 * 24;
}

export function heatIndex(bucket: string, dayKey: string, hour: number) {
  return bucket.startsWith("d:") ? hour : weekdayOfKey(dayKey) * 24 + hour;
}

const lastOfMonth = (year: number, month: number) =>
  `${year}-${pad(month)}-${pad(new Date(Date.UTC(year, month, 0)).getUTCDate())}`;

/** The inclusive day range a `d:`, `w:`, `m:`, `q:` or `y:` bucket covers. */
export function bucketDays(bucket: string): { start: string; end: string } {
  const key = bucket.slice(2);
  switch (bucket.slice(0, 2)) {
    case "d:":
      return { start: key, end: key };
    case "w:": {
      const [year, week] = key.split("-W").map(Number);
      const jan4 = `${year}-01-04`; // ISO week 1 holds January 4th
      const start = addDays(jan4, (week - 1) * 7 - weekdayOfKey(jan4));
      return { start, end: addDays(start, 6) };
    }
    case "m:": {
      const [year, month] = key.split("-").map(Number);
      return { start: `${key}-01`, end: lastOfMonth(year, month) };
    }
    case "q:": {
      const [year, quarter] = key.split("-Q").map(Number);
      return { start: `${year}-${pad(quarter * 3 - 2)}-01`, end: lastOfMonth(year, quarter * 3) };
    }
    case "y:":
      return { start: `${key}-01-01`, end: `${key}-12-31` };
  }
  throw new Error(`Not a calendar bucket: ${bucket}`);
}

/** Every week, month, quarter and year bucket overlapping [from, to], in that order. */
export function periodBucketsBetween(from: string, to: string): string[] {
  const kinds = [weekBucket, monthBucket, quarterBucket, yearBucket].map((of) => ({ of, keys: new Set<string>() }));
  for (let day = from; day <= to; day = addDays(day, 1)) {
    for (const kind of kinds) kind.keys.add(kind.of(day));
  }
  return kinds.flatMap((kind) => [...kind.keys]);
}
