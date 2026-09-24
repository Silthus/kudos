import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireViewer } from "../lib/access";
import {
  comparePeriodValidator,
  familyOf,
  METRICS,
  metricsFromDays,
  raceAxis,
  rangeValidator,
  rowValidator,
  rowVisibility,
  seriesValidator,
  type Metric,
} from "../lib/compare";
import { resolvePeriod } from "../lib/periods";
import { completionsIn, firstQuestWeek, givenKudos, memberDiscoveries, newDiscoveriesIn, questCompletions } from "../lib/compareReads";
import { questsOn } from "../quests";
import { memberDays } from "../lib/stats";
import { dayKeyFor, daysBetween, parseToday, type DayRange } from "../lib/time";

const PREVIOUS_LABELS = { week: "Last week", month: "Last month", quarter: "Last quarter", year: "Last year" } as const;


type Values = Record<Metric, number>;

/**
 * Compare: you this period to date against you last period to date (the Past you benchmark).
 * Reads only the viewer's own rows, so its cost doesn't grow with the workspace.
 */
export const get = query({
  args: {
    period: comparePeriodValidator,
    /** The client's current day in the workspace timezone (see `parseToday`). */
    today: v.string(),
  },
  returns: v.object({
    mode: v.literal("past"),
    period: comparePeriodValidator,
    label: v.string(),
    benchmarkLabel: v.string(),
    range: rangeValidator,
    benchmarkRange: rangeValidator,
    /** The whole previous bucket: where last period finished. */
    previousRange: rangeValidator,
    benchmarkNote: v.union(v.literal("notMember"), v.null()),
    joinedOn: v.union(v.string(), v.null()),
    rows: v.array(rowValidator),
    previousTotal: v.object({ given: v.union(v.number(), v.null()), received: v.union(v.number(), v.null()) }),
    race: v.object({
      days: v.array(v.string()),
      previousDays: v.array(v.string()),
      you: v.object({ given: seriesValidator, received: v.union(seriesValidator, v.null()) }),
      benchmark: v.object({ given: v.union(seriesValidator, v.null()), received: v.union(seriesValidator, v.null()) }),
    }),
    truncated: v.boolean(),
  }),
  handler: async (ctx, { period, today: todayArg }) => {
    const { member, workspace } = await requireViewer(ctx);
    const tz = workspace.timezone;
    const today = parseToday(todayArg);
    const p = resolvePeriod(period, today);
    const current = p.current;
    const previous = p.previous!;
    // Like for like: the same days of the previous period. On the period's last day both periods are
    // complete, so a longer previous period counts in full, as its race line ends (see raceAxis).
    const benchmark = current.end === p.currentFull.end ? previous : p.previousToDate!;

    // One read covers the previous bucket through today: ≤ 2 × 366 rows for "year".
    const span = { start: previous.start, end: current.end, days: daysBetween(previous.start, current.end) + 1 };
    const days = await memberDays(ctx, member._id, span);

    // Membership starts when the member row was created, or earlier if their history says so
    // (back-dated imports, the demo's seeded months). Before it there's nothing to compare, not zero.
    const createdOn = dayKeyFor(member._creationTime, tz);
    const firstDay = await ctx.db
      .query("memberDays")
      .withIndex("by_member_day", (q) => q.eq("memberId", member._id))
      .first();
    const joinedOn = firstDay && firstDay.dayKey < createdOn ? firstDay.dayKey : createdOn;
    const notMember = joinedOn > benchmark.end; // no "by this point last period"
    const noPrevious = joinedOn > previous.end; // no last period at all

    const cur = metricsFromDays(days, current);
    const prev = metricsFromDays(days, benchmark);
    const prevFull = metricsFromDays(days, previous);

    const [curKudos, prevKudos] = await Promise.all([
      givenKudos(ctx, member._id, current, tz),
      givenKudos(ctx, member._id, benchmark, tz),
    ]);

    const discoveries = await memberDiscoveries(ctx, member._id);

    // Quests: the viewer's own completions (≤ 3 a week), and when the workspace's quests began. While
    // quests are off the metric isn't there at all.
    const quests = questsOn(workspace)
      ? { completions: await questCompletions(ctx, member._id, span), since: await firstQuestWeek(ctx, workspace._id) }
      : null;
    const metrics = METRICS.filter((m) => m !== "questsCompleted" || quests);
    // A benchmark that ended before the first quest week had no quests to complete: nothing to compare.
    const noQuestsYet = !quests?.since || benchmark.end < quests.since;

    const values = (m: typeof cur, k: typeof curKudos, r: DayRange): Values => ({
      given: m.given,
      received: m.received,
      activeDays: m.activeDays,
      maxedDays: m.maxedDays,
      longestStreak: m.longestStreak,
      reach: k.reach,
      channels: k.channels,
      questsCompleted: quests ? completionsIn(quests.completions, r, tz) : 0,
      newDiscoveries: newDiscoveriesIn(discoveries, r, tz),
    });
    const you = values(cur, curKudos, current);
    const them = values(prev, prevKudos, benchmark);

    // A capped kudos read would compare different windows (the most recent days of each range), so
    // reach and channels show no number rather than a misleading one.
    const truncated = curKudos.truncated || prevKudos.truncated;
    const uncounted = (metric: Metric) => truncated && (metric === "reach" || metric === "channels");

    const rows = metrics.map((metric) => {
      const locked = rowVisibility(workspace.receivedVisibility, "past", metric);
      const youValue = locked || uncounted(metric) ? null : you[metric];
      const noBenchmark = notMember || uncounted(metric) || (metric === "questsCompleted" && noQuestsYet);
      const benchmarkValue = locked || noBenchmark ? null : them[metric];
      return {
        metric,
        family: familyOf(metric),
        you: { value: youValue, locked },
        benchmark: { value: benchmarkValue, locked },
        delta: youValue !== null && benchmarkValue !== null ? youValue - benchmarkValue : null,
      };
    });
    const receivedLocked = rowVisibility(workspace.receivedVisibility, "past", "received") !== null;

    const axis = raceAxis(p.currentFull, previous);
    const pad = (series: number[]) => axis.days.map((_, i) => (i < series.length ? series[i] : null));
    const aligned = (series: number[]) => axis.previousDays.map((d) => series[daysBetween(previous.start, d)]);

    return {
      mode: "past" as const,
      period,
      label: p.label,
      benchmarkLabel: PREVIOUS_LABELS[period],
      range: current,
      benchmarkRange: benchmark,
      previousRange: previous,
      benchmarkNote: notMember ? ("notMember" as const) : null,
      joinedOn: notMember ? joinedOn : null,
      rows,
      previousTotal: {
        given: noPrevious ? null : prevFull.given,
        received: noPrevious || receivedLocked ? null : prevFull.received,
      },
      race: {
        days: axis.days,
        previousDays: axis.previousDays,
        you: { given: pad(cur.cumulativeGiven), received: receivedLocked ? null : pad(cur.cumulativeReceived) },
        benchmark: {
          given: noPrevious ? null : aligned(prevFull.cumulativeGiven),
          received: noPrevious || receivedLocked ? null : aligned(prevFull.cumulativeReceived),
        },
      },
      truncated,
    };
  },
});
