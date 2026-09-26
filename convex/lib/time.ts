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

/**
 * The workspace clock: a workspace's "now". Every write path reads the time through this, so a
 * workspace with a `clockOffsetMs` (a visitor's simulator, #143) lives that far ahead of the wall
 * clock: its kudos land on its own day, its allowance, quest weeks, plants, sprees and bonus days
 * follow its own days. Without an offset (every real workspace and the shared demo) it is `Date.now()`.
 * The web client adds the same offset to compute the workspace's today (src/lib/period.ts).
 */
export function workspaceNow(workspace: { clockOffsetMs?: number }, wallClock = Date.now()): number {
  return wallClock + (workspace.clockOffsetMs ?? 0);
}

/**
 * When a DM was sent, on its workspace's clock: the time it keeps (#171), or for a row from before
 * it kept one, its creation told with the clock's offset now.
 */
export function sentAt(notification: { at?: number; _creationTime: number }, workspace: { clockOffsetMs?: number }): number {
  return notification.at ?? workspaceNow(workspace, notification._creationTime);
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

/** Start of the local day after the one containing `now`: when day-, week- and period-scoped views roll over. */
export function nextDayStartUtc(now: number, timeZone: string): number {
  return startOfDayUtc(addDays(dayKeyFor(now, timeZone), 1), timeZone);
}

/**
 * How long a client should wait before re-checking its day key: until the next local midnight, but never
 * less than a second, since a calendar day that doesn't exist (Samoa, 2011-12-30) has no midnight to wait for.
 */
export function msUntilRollover(now: number, timeZone: string): number {
  return Math.max(nextDayStartUtc(now, timeZone) - now, 1_000);
}

/** The first day the app ever looks at; "all time" starts here. */
export const EPOCH_DAY = "2000-01-01";
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

export function eachDay(r: DayRange): string[] {
  const out: string[] = [];
  for (let i = 0; i < r.days; i++) out.push(addDays(r.start, i));
  return out;
}
