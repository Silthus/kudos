import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  cellValidator,
  comparePeriodValidator,
  familyOf,
  familyValidator,
  metricValidator,
  rangeValidator,
  rowVisibility,
  TEAM_METRICS,
  teamDistributionValidator,
  teamStanding,
  type TeamMetric,
} from "../lib/compare";
import { requireViewer } from "../lib/access";
import { resolvePeriod } from "../lib/periods";
import { memberTotalsInRange, workspaceMembers, type Totals } from "../lib/stats";
import { parseToday } from "../lib/time";
import { questsOn } from "../quests";

const ZERO: Totals = { given: 0, received: 0, activeDays: 0, maxedDays: 0 };

/** Who takes part in a metric: receiving is its own population, every giving metric is about the givers. */
const takesPart = (t: Totals, metric: TeamMetric) => (metric === "received" ? t.received > 0 : t.given > 0);

/**
 * Compare: you against the team this period to date (the Team benchmark). The team is every teammate
 * who takes part: active, not a bot, not you, and with a value > 0 (given for the giving metrics,
 * received for received). Only the distribution leaves the server, never a name, and small teams get
 * less of it (see `teamStanding`). Reads the period's rollup row per member and the member list: at
 * 500 members ≈ 1k documents, whatever the period.
 */
export const get = query({
  args: {
    period: comparePeriodValidator,
    /** The client's current day in the workspace timezone (see `parseToday`). */
    today: v.string(),
  },
  returns: v.object({
    mode: v.literal("team"),
    period: comparePeriodValidator,
    label: v.string(),
    range: rangeValidator,
    /** Teammates who gave this period: the headline's population. */
    participants: v.number(),
    rows: v.array(
      v.object({
        metric: metricValidator,
        family: familyValidator,
        you: cellValidator,
        /** The team median, as every benchmark's second column. */
        benchmark: cellValidator,
        delta: v.null(),
        team: v.union(teamDistributionValidator, v.null()),
        /** Share of the team strictly below you (0–1). */
        percentile: v.union(v.number(), v.null()),
      }),
    ),
    truncated: v.boolean(),
  }),
  handler: async (ctx, { period, today }) => {
    const { member: me, workspace } = await requireViewer(ctx);
    const p = resolvePeriod(period, parseToday(today));
    const { totals, truncated } = await memberTotalsInRange(ctx, workspace, p);
    const teammates: Id<"members">[] = (await workspaceMembers(ctx, workspace._id))
      .filter((m) => !m.deactivated && m._id !== me._id)
      .map((m) => m._id);
    const mine = totals.get(me._id) ?? ZERO;

    const rows = TEAM_METRICS.map((metric) => {
      const locked = rowVisibility(workspace.receivedVisibility, "team", metric);
      const others = teammates
        .map((id) => totals.get(id))
        .filter((t): t is Totals => t !== undefined && takesPart(t, metric))
        .map((t) => t[metric]);
      const standing = locked ? { team: null, percentile: null } : teamStanding(others, mine[metric], takesPart(mine, metric));
      return {
        metric,
        family: familyOf(metric),
        you: { value: locked ? null : mine[metric], locked },
        benchmark: { value: standing.team?.median ?? null, locked },
        delta: null,
        team: standing.team,
        // A capped read misses some of the team, so "more than N% of them" can't be claimed.
        percentile: truncated ? null : standing.percentile,
      };
    });

    // Quests are only ever the member's own, so the team gets no aggregate of them either (Quest spec
    // D10): a locked row, and nothing read. While quests are off the metric isn't there at all.
    const personal = (["questsCompleted"] as const).filter(() => questsOn(workspace)).map((metric) => {
      const locked = rowVisibility(workspace.receivedVisibility, "team", metric);
      return {
        metric,
        family: familyOf(metric),
        you: { value: null, locked },
        benchmark: { value: null, locked },
        delta: null,
        team: null,
        percentile: null,
      };
    });

    return {
      mode: "team" as const,
      period,
      label: p.label,
      range: p.current,
      participants: teammates.filter((id) => takesPart(totals.get(id) ?? ZERO, "given")).length,
      rows: [...rows, ...personal],
      truncated,
    };
  },
});
