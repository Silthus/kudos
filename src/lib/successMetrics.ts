import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import { pct } from "./format";

export type SuccessResult = FunctionReturnType<typeof api.analytics.successMetrics>;
export type SuccessMonth = SuccessResult["months"][number];
export type MetricKey = "recipientsPerGiver" | "storyShare" | "reciprocalShare" | "participation";

/** Which way the game should move a metric (spec #55 G18): up, not up, or just keep an eye on it. */
export type Goal = "rise" | "hold" | "watch";

export type SuccessMetric = { key: MetricKey; label: string; hint: string; goal: Goal; share: boolean };

/** The success metrics in the spec's order, participation last ("also watch"). */
export const SUCCESS_METRICS: SuccessMetric[] = [
  { key: "recipientsPerGiver", label: "Reach", hint: "different people each giver recognized", goal: "rise", share: false },
  { key: "storyShare", label: "Says why", hint: "of kudos with a 12+ word note", goal: "rise", share: true },
  { key: "reciprocalShare", label: "Thank-backs", hint: "of kudos return one from the last 72 h", goal: "hold", share: true },
  { key: "participation", label: "Participation", hint: "of the team gave kudos", goal: "watch", share: true },
];

export const GOAL_LABEL: Record<Goal, string> = { rise: "should rise", hold: "must not rise", watch: "watch" };

export function formatMetric(key: MetricKey, value: number | null) {
  if (value === null) return "–";
  return SUCCESS_METRICS.find((m) => m.key === key)!.share ? pct(value) : value.toFixed(1);
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
];

/** The months as CSV with raw values, for keeping the baseline outside the app. */
export function successCsv(result: Pick<SuccessResult, "months">) {
  const lines = [CSV_COLUMNS.map(([name]) => name).join(",")];
  for (const m of result.months) lines.push(CSV_COLUMNS.map(([, value]) => String(value(m) ?? "")).join(","));
  return lines.join("\n") + "\n";
}
