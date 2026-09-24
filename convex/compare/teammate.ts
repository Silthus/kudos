import { ConvexError, v } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { publicMember, requireViewer, type Viewer } from "../lib/access";
import {
  comparePeriodValidator,
  familyOf,
  METRICS,
  metricsFromDays,
  rangeValidator,
  rowValidator,
  rowVisibility,
  seriesValidator,
  TEAMMATE_UNAVAILABLE,
  type Metric,
} from "../lib/compare";
import { givenKudos, memberDiscoveries, newDiscoveriesIn } from "../lib/compareReads";
import { resolvePeriod } from "../lib/periods";
import { questsOn } from "../quests";
import { memberDays } from "../lib/stats";
import { eachDay, parseToday, type DayRange } from "../lib/time";

const memberValidator = v.object({
  _id: v.id("members"),
  slackUserId: v.string(),
  name: v.string(),
  realName: v.optional(v.string()),
  title: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
});

/**
 * The member to compare with: somebody else in the viewer's workspace who is a person and still
 * active. Ids come from the URL, so a malformed id, another table's id and a removed member all get
 * the same answer as an ineligible one.
 */
async function eligibleTeammate(ctx: QueryCtx, { member: me, workspace }: Viewer, memberId: string): Promise<Doc<"members">> {
  const id = ctx.db.normalizeId("members", memberId);
  const them = id ? await ctx.db.get(id) : null;
  if (!them || them.workspaceId !== workspace._id || them.isBot || them.deactivated || them._id === me._id) {
    throw new ConvexError(TEAMMATE_UNAVAILABLE);
  }
  return them;
}

/** One side of the head-to-head: every metric over `range`, plus its cumulative race series. */
async function subject(ctx: QueryCtx, memberId: Id<"members">, range: DayRange, timeZone: string) {
  const [days, kudos, discoveries] = await Promise.all([
    memberDays(ctx, memberId, range),
    givenKudos(ctx, memberId, range, timeZone),
    memberDiscoveries(ctx, memberId),
  ]);
  const m = metricsFromDays(days, range);
  const values: Record<Metric, number | null> = {
    given: m.given,
    received: m.received,
    activeDays: m.activeDays,
    maxedDays: m.maxedDays,
    longestStreak: m.longestStreak,
    reach: kudos.reach,
    channels: kudos.channels,
    questsCompleted: null, // never read: quests are only ever the member's own (Quest spec D10)
    newDiscoveries: newDiscoveriesIn(discoveries, range, timeZone),
  };
  return { values, cumulativeGiven: m.cumulativeGiven, cumulativeReceived: m.cumulativeReceived, truncated: kudos.truncated };
}

/**
 * Compare: you against one teammate over this period to date (the Teammate benchmark). Reads only
 * the two members' own rows, so its cost doesn't grow with the workspace. Received-derived rows are
 * locked unless the workspace shows received counts to everyone: a row is shown only when both
 * subjects in it are visible to the viewer.
 */
export const get = query({
  args: {
    period: comparePeriodValidator,
    /** The client's current day in the workspace timezone (see `parseToday`). */
    today: v.string(),
    /** From the URL (`?vs=<id>`), so validated here rather than by `v.id`. */
    memberId: v.string(),
  },
  returns: v.object({
    mode: v.literal("teammate"),
    period: comparePeriodValidator,
    label: v.string(),
    /** This period to date: the range both sides are counted over. */
    range: rangeValidator,
    teammate: memberValidator,
    rows: v.array(rowValidator),
    /** Cumulative kudos per day of the whole period; null after today, and received null while locked. */
    race: v.object({
      days: v.array(v.string()),
      you: v.object({ given: seriesValidator, received: v.union(seriesValidator, v.null()) }),
      benchmark: v.object({ given: seriesValidator, received: v.union(seriesValidator, v.null()) }),
    }),
    truncated: v.boolean(),
  }),
  handler: async (ctx, { period, today: todayArg, memberId }) => {
    const viewer = await requireViewer(ctx);
    const them = await eligibleTeammate(ctx, viewer, memberId);
    const { receivedVisibility: visibility, timezone: tz } = viewer.workspace;
    const p = resolvePeriod(period, parseToday(todayArg));
    const range = p.current;

    const [you, other] = await Promise.all([subject(ctx, viewer.member._id, range, tz), subject(ctx, them._id, range, tz)]);

    // A capped kudos read counts only that member's most recent days, so their reach and channels
    // show no number. Both sides cover the same days, so the other side stays countable.
    const uncounted = (side: typeof you, metric: Metric) => side.truncated && (metric === "reach" || metric === "channels");

    // While quests are off the metric isn't there at all; while on, its row is always locked.
    const metrics = METRICS.filter((m) => m !== "questsCompleted" || questsOn(viewer.workspace));
    const rows = metrics.map((metric) => {
      const locked = rowVisibility(visibility, "teammate", metric);
      const youValue = locked || uncounted(you, metric) ? null : you.values[metric];
      const benchmarkValue = locked || uncounted(other, metric) ? null : other.values[metric];
      return {
        metric,
        family: familyOf(metric),
        you: { value: youValue, locked },
        benchmark: { value: benchmarkValue, locked },
        delta: youValue !== null && benchmarkValue !== null ? youValue - benchmarkValue : null,
      };
    });

    const receivedLocked = rowVisibility(visibility, "teammate", "received") !== null;
    const days = eachDay(p.currentFull);
    const pad = (series: number[]) => days.map((_, i) => (i < series.length ? series[i] : null));

    return {
      mode: "teammate" as const,
      period,
      label: p.label,
      range,
      teammate: publicMember(them),
      rows,
      race: {
        days,
        you: { given: pad(you.cumulativeGiven), received: receivedLocked ? null : pad(you.cumulativeReceived) },
        benchmark: { given: pad(other.cumulativeGiven), received: receivedLocked ? null : pad(other.cumulativeReceived) },
      },
      truncated: you.truncated || other.truncated,
    };
  },
});
