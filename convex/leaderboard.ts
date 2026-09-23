import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireViewer, type Viewer } from "./lib/access";
import {
  backfilledRollups,
  discoveriesIn,
  givenOverDays,
  memberBucket,
  rankBy,
  totalsByMember,
  totalsOf,
  workspaceBucket,
  workspaceDays,
  workspaceMembers,
  type Totals,
} from "./lib/stats";
import { resolvePeriod, type PeriodRange } from "./lib/periods";
import { parseToday, periodValidator, startOfDayUtc, type Period } from "./lib/time";

type Metric = "given" | "received";

/** What the board is built from, whichever way it was read. */
type Standings = {
  current: Map<Id<"members">, Totals>;
  /** The whole previous bucket: values, ranks and rank changes compare with it. Null for all time. */
  previous: Map<Id<"members">, Totals> | null;
  total: number;
  /** The previous bucket to date: the workspace headline compares with it, like analytics. */
  prevTotal: number | null;
  givers: number;
  maxedDays: number;
  discoveries: number;
  legendaryFinds: number;
};

export const get = query({
  args: {
    period: periodValidator,
    metric: v.union(v.literal("given"), v.literal("received")),
    /** The client's current day in the workspace timezone (see `parseToday`). */
    today: v.string(),
  },
  handler: async (ctx, { period, metric, today }) => {
    return await leaderboard(ctx, await requireViewer(ctx), { period, metric, today });
  },
});

export async function leaderboard(
  ctx: QueryCtx,
  { workspace, member: me }: Viewer,
  { period, metric: requested, today }: { period: Period; metric: Metric; today: string },
) {
  const receivedAllowed = workspace.receivedVisibility === "everyone";
  const metric = requested === "received" && receivedAllowed ? "received" : "given";
  const range = resolvePeriod(period, parseToday(today));
  const members = await workspaceMembers(ctx, workspace._id);
  const active = members.filter((m) => !m.deactivated);

  // The `all` rollup row, once backfilled: its presence switches the board onto the rollups.
  const allStats = await backfilledRollups(ctx, workspace._id);
  const standings =
    period === "all"
      ? await allTime(ctx, workspace, members, metric, allStats)
      : allStats
        ? await fromRollups(ctx, workspace, range, metric)
        : await fromMemberDays(ctx, workspace, range, metric);
  const { current, previous } = standings;

  const value = (t: Totals | undefined) => (t ? t[metric] : 0);
  const participants = members.filter((m) => value(current.get(m._id)) > 0);
  const ranked = rankBy(participants, (m) => value(current.get(m._id)), (m) => m.name);
  const prevRanked = previous
    ? new Map(
        rankBy(
          members.filter((m) => value(previous.get(m._id)) > 0),
          (m) => value(previous.get(m._id)),
          (m) => m.name,
        ).map(({ item, rank }) => [item._id, rank]),
      )
    : null;

  const rows = ranked.map(({ item: m, rank }) => {
    const cur = current.get(m._id);
    const prev = previous?.get(m._id);
    const prevRank = prevRanked?.get(m._id) ?? null;
    return {
      rank,
      member: { _id: m._id, name: m.name, title: m.title ?? null, avatarUrl: m.avatarUrl ?? null, slackUserId: m.slackUserId },
      value: value(cur),
      prevValue: previous ? value(prev) : null,
      delta: previous ? value(cur) - value(prev) : null,
      prevRank,
      rankChange: prevRanked ? (prevRank === null ? null : prevRank - rank) : null,
      isNew: prevRanked ? prevRank === null : false,
      maxedDays: cur?.maxedDays ?? 0,
      isMe: m._id === me._id,
    };
  });

  return {
    period: range.period,
    label: range.label,
    range: period === "all" ? null : { start: range.current.start, end: range.current.end },
    previousRange: range.previous ? { start: range.previous.start, end: range.previous.end } : null,
    metric,
    receivedAllowed,
    rows,
    highlights: {
      total: standings.total,
      prevTotal: standings.prevTotal,
      givers: standings.givers,
      teamSize: active.length,
      participation: active.length ? standings.givers / active.length : 0,
      rising: rows.filter((r) => (r.delta ?? 0) > 0).length,
      discoveries: standings.discoveries,
      legendaryFinds: standings.legendaryFinds,
      maxedDays: standings.maxedDays,
    },
    unit: { singular: workspace.unitSingular, plural: workspace.unitPlural, glyph: workspace.emojiGlyph },
    myRow: rows.find((r) => r.isMe) ?? null,
  };
}

/**
 * A w/m/q/y board from the rollups: the members' current and previous bucket rows for the
 * metric (≤ one per member each), the bucket's workspace row, and the `d:` rows of the
 * previous bucket to date (≤366).
 */
async function fromRollups(ctx: QueryCtx, workspace: Doc<"workspaces">, range: PeriodRange, metric: Metric): Promise<Standings> {
  const cur = await memberBucket(ctx, workspace._id, range.bucket, metric);
  const prev = await memberBucket(ctx, workspace._id, range.previousBucket!, metric);
  const stats = await workspaceBucket(ctx, workspace._id, range.bucket);
  return {
    current: totalsOf(cur),
    previous: totalsOf(prev),
    total: cur.reduce((s, r) => s + r[metric], 0),
    // Every unit given is a unit received, so the day rows' `given` is either metric's total.
    prevTotal: await givenOverDays(ctx, workspace._id, range.previousToDate!),
    givers: stats?.givers ?? 0,
    maxedDays: stats?.maxedDays ?? 0,
    ...discoveriesIn(stats),
  };
}

/** A w/m/q/y board from `memberDays`, for workspaces whose rollups aren't backfilled yet. */
async function fromMemberDays(ctx: QueryCtx, workspace: Doc<"workspaces">, range: PeriodRange, metric: Metric): Promise<Standings> {
  const cur = await workspaceDays(ctx, workspace._id, range.current);
  const prev = await workspaceDays(ctx, workspace._id, range.previous!);
  const current = totalsByMember(cur.rows);
  // A capped read keeps the newest days, i.e. drops exactly the to-date part: read it on its own then.
  const toDate = prev.truncated
    ? await workspaceDays(ctx, workspace._id, range.previousToDate!)
    : { rows: prev.rows.filter((r) => r.dayKey <= range.previousToDate!.end) };
  const found = await ctx.db
    .query("discoveries")
    .withIndex("by_workspace_firstSeen", (q) =>
      q.eq("workspaceId", workspace._id).gte("firstSeenAt", startOfDayUtc(range.current.start, workspace.timezone)),
    )
    .take(5000);
  return {
    current,
    previous: totalsByMember(prev.rows),
    total: sum(current.values(), (t) => t[metric]),
    prevTotal: toDate.rows.reduce((s, r) => s + r[metric], 0),
    givers: [...current.values()].filter((t) => t.given > 0).length,
    maxedDays: sum(current.values(), (t) => t.maxedDays),
    discoveries: found.length,
    legendaryFinds: found.filter((d) => d.rarity === "legendary").length,
  };
}

/** All time lives on the members themselves; only the discoveries come from the rollups. */
async function allTime(
  ctx: QueryCtx,
  workspace: Doc<"workspaces">,
  members: Doc<"members">[],
  metric: Metric,
  allStats: Doc<"workspaceStats"> | null,
): Promise<Standings> {
  const current = new Map(
    members.map((m) => [m._id, { given: m.totalGiven, received: m.totalReceived, maxedDays: m.totalMaxedDays, activeDays: 0 }]),
  );
  const found = allStats ? discoveriesIn(allStats) : await legacyDiscoveries(ctx, workspace._id);
  return {
    current,
    previous: null,
    total: sum(current.values(), (t) => t[metric]),
    prevTotal: null,
    givers: [...current.values()].filter((t) => t.given > 0).length,
    maxedDays: sum(current.values(), (t) => t.maxedDays),
    ...found,
  };
}

async function legacyDiscoveries(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const found = await ctx.db
    .query("discoveries")
    .withIndex("by_workspace_firstSeen", (q) => q.eq("workspaceId", workspaceId))
    .take(5000);
  return { discoveries: found.length, legendaryFinds: found.filter((d) => d.rarity === "legendary").length };
}

function sum<T>(items: Iterable<T>, of: (t: T) => number) {
  let s = 0;
  for (const item of items) s += of(item);
  return s;
}
