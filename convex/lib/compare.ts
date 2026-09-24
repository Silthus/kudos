import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { median } from "./stats";
import { addDays, daysBetween, eachDay, type DayRange } from "./time";

/**
 * Compare offers the calendar periods that have a previous period: "all time" has none, and would
 * favour tenure over generosity.
 */
export const comparePeriodValidator = v.union(v.literal("week"), v.literal("month"), v.literal("quarter"), v.literal("year"));
export type ComparePeriod = Infer<typeof comparePeriodValidator>;

export const METRICS = [
  "given",
  "received",
  "activeDays",
  "maxedDays",
  "longestStreak",
  "reach",
  "channels",
  "questsCompleted",
  "newDiscoveries",
] as const;
export type Metric = (typeof METRICS)[number];
export const metricValidator = v.union(...METRICS.map((m) => v.literal(m)));

export type Family = "giving" | "receiving";
export const familyValidator = v.union(v.literal("giving"), v.literal("receiving"));

/**
 * Why a cell has no value: the workspace hides received counts, or shows them to each member only;
 * or the metric is personal by design (quests are only ever the member's own, Quest spec D10).
 */
export type Locked = "hidden" | "private" | "personal" | null;
export const lockedValidator = v.union(v.literal("hidden"), v.literal("private"), v.literal("personal"), v.null());

export const rangeValidator = v.object({ start: v.string(), end: v.string(), days: v.number() });
/** One side of a scoreboard row: `value` is null when the row is locked or can't be counted. */
export const cellValidator = v.object({ value: v.union(v.number(), v.null()), locked: lockedValidator });
/** A cumulative race series: null for days that haven't happened yet. */
export const seriesValidator = v.array(v.union(v.number(), v.null()));
export const rowValidator = v.object({
  metric: metricValidator,
  family: familyValidator,
  you: cellValidator,
  benchmark: cellValidator,
  delta: v.union(v.number(), v.null()),
});

/** `compare.teammate.get`'s answer for any id that isn't somebody the viewer can compare with. */
export const TEAMMATE_UNAVAILABLE = "That teammate isn't available to compare.";

export type CompareMode = "past" | "team" | "teammate";

/** Received-derived metrics reveal kudos somebody received (receiver_success discoveries are unlocked by receiving). */
export function familyOf(metric: Metric): Family {
  return metric === "received" || metric === "newDiscoveries" ? "receiving" : "giving";
}

/**
 * Whether a row is locked for the viewer. Received-derived rows follow `receivedVisibility`, and a row is
 * shown only when every subject in it is visible. Past you involves only the viewer, whose own discoveries
 * are always theirs to see (the Me and Discoveries pages show them); their received count is not under
 * `hidden`, matching `me.overview`. Quests completed is only ever the viewer's own, in any workspace.
 */
export function rowVisibility(visibility: Doc<"workspaces">["receivedVisibility"], mode: CompareMode, metric: Metric): Locked {
  // No teammate's quest count and no team aggregate either (Quest spec D10).
  if (metric === "questsCompleted") return mode === "past" ? null : "personal";
  if (familyOf(metric) === "giving") return null;
  if (visibility === "everyone") return null;
  if (mode === "past") return metric === "received" && visibility === "hidden" ? "hidden" : null;
  return visibility === "self" ? "private" : "hidden";
}

/** Distinct teammates and distinct channels (by id: names change) in a set of given kudos. */
export function reachFromKudos(rows: { receiverId: string; channelId: string }[]) {
  return {
    reach: new Set(rows.map((r) => r.receiverId)).size,
    channels: new Set(rows.map((r) => r.channelId)).size,
  };
}

/** Linear-interpolated quantile of an ascending array. */
function quantile(sorted: number[], q: number) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Five-number summary of a population; never names anybody. */
export function distribution(values: number[]) {
  if (values.length === 0) return { n: 0, min: 0, p25: 0, median: 0, p75: 0, max: 0 };
  const s = [...values].sort((a, b) => a - b);
  return { n: s.length, min: s[0], p25: quantile(s, 0.25), median: median(s), p75: quantile(s, 0.75), max: s[s.length - 1] };
}

/** Share of `others` strictly below `value` (0–1): ties don't count as "more than". */
export function percentileBelow(value: number, others: number[]) {
  if (others.length === 0) return 0;
  return others.filter((o) => o < value).length / others.length;
}

/** Fewer teammates than this and a median would be one person's number: the Team benchmark shows none. */
export const MIN_TEAM = 2;
/** Quartiles, the maximum and your percentile appear from this many teammates on (a privacy and statistics floor). */
export const MIN_DISTRIBUTION = 5;

/** The metrics the Team benchmark has for every member from the rollups. */
export const TEAM_METRICS = ["given", "received", "activeDays", "maxedDays"] as const satisfies readonly Metric[];
export type TeamMetric = (typeof TEAM_METRICS)[number];

const nullableNumber = v.union(v.number(), v.null());
export const teamDistributionValidator = v.object({
  n: v.number(),
  median: v.number(),
  p25: nullableNumber,
  p75: nullableNumber,
  max: nullableNumber,
});

/**
 * Where the team sits on one metric, from the values of the teammates who take part (never the viewer's
 * own). Null below `MIN_TEAM`; below `MIN_DISTRIBUTION` only the median, so no single teammate's value
 * can be read off the edges. `percentile` is the share of them strictly below `you`, and only for a
 * viewer who takes part themselves.
 */
export function teamStanding(others: number[], you: number, youTakePart: boolean) {
  if (others.length < MIN_TEAM) return { team: null, percentile: null };
  const d = distribution(others);
  const full = others.length >= MIN_DISTRIBUTION;
  return {
    team: { n: d.n, median: d.median, p25: full ? d.p25 : null, p75: full ? d.p75 : null, max: full ? d.max : null },
    percentile: full && youTakePart ? percentileBelow(you, others) : null,
  };
}

/**
 * The race chart's x axis: every day of the current bucket, each lined up with the same day of the
 * previous bucket. Buckets differ in length (months, leap years), so the last day always pairs with
 * the previous bucket's last day, and a shorter previous bucket holds its last day.
 */
export function raceAxis(currentFull: DayRange, previous: DayRange) {
  const days = eachDay(currentFull);
  const previousDays = days.map((_, i) =>
    i === days.length - 1 || i >= previous.days - 1 ? previous.end : addDays(previous.start, i),
  );
  return { days, previousDays };
}

type DayRow = Pick<Doc<"memberDays">, "dayKey" | "given" | "received" | "maxed">;

/** One member's day-level metrics over `range`, plus cumulative series with one entry per day. */
export function metricsFromDays(rows: DayRow[], range: DayRange) {
  const byDay = new Map(rows.filter((r) => r.dayKey >= range.start && r.dayKey <= range.end).map((r) => [r.dayKey, r]));
  let given = 0;
  let received = 0;
  let activeDays = 0;
  let maxedDays = 0;
  const active: string[] = [];
  const cumulativeGiven: number[] = [];
  const cumulativeReceived: number[] = [];
  for (const d of eachDay(range)) {
    const row = byDay.get(d);
    if (row) {
      given += row.given;
      received += row.received;
      if (row.given > 0) {
        activeDays += 1;
        active.push(d);
      }
      if (row.maxed) maxedDays += 1;
    }
    cumulativeGiven.push(given);
    cumulativeReceived.push(received);
  }
  return {
    given,
    received,
    activeDays,
    maxedDays,
    longestStreak: streaks(active, range.end).longest,
    cumulativeGiven,
    cumulativeReceived,
  };
}

/** Longest run of consecutive active days, and the run still alive today (active today or yesterday). */
export function streaks(activeDays: string[], today: string) {
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of activeDays) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const last = activeDays[activeDays.length - 1];
  const current = last && daysBetween(last, today) <= 1 ? run : 0;
  return { longest, current };
}
