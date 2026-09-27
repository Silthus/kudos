import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import { pct } from "./format";

export type SuccessResult = FunctionReturnType<typeof api.analytics.successMetrics>;
export type SuccessMonth = SuccessResult["months"][number];
export type MetricKey =
  | "recipientsPerGiver"
  | "storyShare"
  | "reciprocalShare"
  | "participation"
  | "claimsPerPlayerWeek"
  | "claimedSoonShare"
  | "expeditionsPerPlayer"
  | "crewContributors";

/** Which way the game should move a metric (spec #55 G18): up, not up, or just keep an eye on it. */
export type Goal = "rise" | "hold" | "watch";

/** How a metric reads: a share ("33%"), a ratio ("2.5") or a count ("4"). */
type Shape = "share" | "ratio" | "count";

export type SuccessMetric = { key: MetricKey; label: string; hint: string; goal: Goal; shape: Shape };

/**
 * The success metrics in the spec's order, participation last ("also watch"), then the game's own
 * (#165, plan #152 S11): watched, since they have no time before the game to compare with.
 */
export const SUCCESS_METRICS: SuccessMetric[] = [
  { key: "recipientsPerGiver", label: "Reach", hint: "different people each giver recognized", goal: "rise", shape: "ratio" },
  { key: "storyShare", label: "Says why", hint: "of kudos with a 12+ word note", goal: "rise", shape: "share" },
  { key: "reciprocalShare", label: "Thank-backs", hint: "of kudos return one from the last 72 h", goal: "hold", shape: "share" },
  { key: "participation", label: "Participation", hint: "of the team gave kudos", goal: "watch", shape: "share" },
  { key: "claimsPerPlayerWeek", label: "Claims at the stone", hint: "per active player a week", goal: "watch", shape: "ratio" },
  { key: "claimedSoonShare", label: "Claimed within a week", hint: "of Hog coins offered, claimed by their giver within 7 days (a month settles a week after it ends)", goal: "watch", shape: "share" },
  { key: "expeditionsPerPlayer", label: "Expeditions", hint: "cleared per active player, the blight raid included", goal: "watch", shape: "ratio" },
  { key: "crewContributors", label: "Crew contributors", hint: "teammates who first gave to a crew quest", goal: "watch", shape: "count" },
];

export const GOAL_LABEL: Record<Goal, string> = { rise: "should rise", hold: "must not rise", watch: "watch" };

export function formatMetric(key: MetricKey, value: number | null) {
  if (value === null) return "–";
  const shape = SUCCESS_METRICS.find((m) => m.key === key)!.shape;
  return shape === "share" ? pct(value) : shape === "count" ? String(value) : value.toFixed(1);
}

/** This month against the baseline, in the direction that counts; null when either is missing. */
export function verdict(metric: SuccessMetric, current: number | null, baseline: number | null) {
  if (current === null || baseline === null || metric.goal === "watch") return null;
  if (formatMetric(metric.key, current) === formatMetric(metric.key, baseline)) return "same" as const;
  const up = current > baseline;
  return up === (metric.goal === "rise") ? ("better" as const) : ("worse" as const);
}

const CSV_COLUMNS: [string, (m: SuccessMonth) => string | number | boolean | null][] = [
  ["month", (m) => m.month],
  ["to_date", (m) => m.toDate],
  ["givers", (m) => m.givers],
  ["team_size", (m) => m.teamSize],
  ["participation", (m) => m.participation],
  ["kudos", (m) => m.kudos],
  ["recipients_per_giver", (m) => m.recipientsPerGiver],
  ["story_share", (m) => m.storyShare],
  ["reciprocal_share", (m) => m.reciprocalShare],
  ["claims_per_player_week", (m) => m.claimsPerPlayerWeek],
  ["claimed_within_7_days_share", (m) => m.claimedSoonShare],
  ["expeditions_per_player", (m) => m.expeditionsPerPlayer],
  ["crew_contributors", (m) => m.crewContributors],
];

/** The months as CSV with raw values, for keeping the baseline outside the app. */
export function successCsv(result: Pick<SuccessResult, "months">) {
  const lines = [CSV_COLUMNS.map(([name]) => name).join(",")];
  for (const m of result.months) lines.push(CSV_COLUMNS.map(([, value]) => String(value(m) ?? "")).join(","));
  return lines.join("\n") + "\n";
}
