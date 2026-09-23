import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireViewer } from "./lib/access";
import { rankBy, totalsByMember, workspaceDays, workspaceMembers, type Totals } from "./lib/stats";
import { parseToday, periodValidator, resolvePeriod, startOfDayUtc } from "./lib/time";

export const get = query({
  args: {
    period: periodValidator,
    metric: v.union(v.literal("given"), v.literal("received")),
    /** The client's current day in the workspace timezone (see `parseToday`). */
    today: v.string(),
  },
  handler: async (ctx, { period, metric: requested, today }) => {
    const viewer = await requireViewer(ctx);
    const { workspace, member: me } = viewer;
    const receivedAllowed = workspace.receivedVisibility === "everyone";
    const metric = requested === "received" && receivedAllowed ? "received" : "given";
    // Values, ranks and rank changes compare with the whole previous bucket ("last week's final rank").
    const range = resolvePeriod(period, parseToday(today));
    const members = await workspaceMembers(ctx, workspace._id);
    const active = members.filter((m) => !m.deactivated);

    let current: Map<Id<"members">, Totals>;
    let previous: Map<Id<"members">, Totals> | null = null;
    // The workspace headline compares with the previous period to date, like analytics does.
    let prevTotal: number | null = null;
    let truncated = false;
    if (period === "all") {
      current = new Map(
        members.map((m) => [
          m._id,
          { given: m.totalGiven, received: m.totalReceived, maxedDays: m.totalMaxedDays, activeDays: 0 },
        ]),
      );
    } else {
      const cur = await workspaceDays(ctx, workspace._id, range.current);
      const prev = await workspaceDays(ctx, workspace._id, range.previous!);
      current = totalsByMember(cur.rows);
      previous = totalsByMember(prev.rows);
      // A capped read keeps the newest days, i.e. drops exactly the to-date part: read it on its own then.
      const toDate = prev.truncated
        ? await workspaceDays(ctx, workspace._id, range.previousToDate!)
        : { rows: prev.rows.filter((r) => r.dayKey <= range.previousToDate!.end), truncated: false };
      prevTotal = toDate.rows.reduce((s, r) => s + r[metric], 0);
      truncated = cur.truncated || prev.truncated || toDate.truncated;
    }

    const value = (t: Totals | undefined) => (t ? t[metric] : 0);
    const participants = members.filter((m) => value(current.get(m._id)) > 0);
    const ranked = rankBy(participants, (m) => value(current.get(m._id)), (m) => m.name);
    const prevRanked = previous
      ? new Map(
          rankBy(
            members.filter((m) => value(previous!.get(m._id)) > 0),
            (m) => value(previous!.get(m._id)),
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

    const total = [...current.values()].reduce((s, t) => s + t[metric], 0);
    const givers = [...current.values()].filter((t) => t.given > 0).length;

    const since = period === "all" ? 0 : startOfDayUtc(range.current.start, workspace.timezone);
    const found = await ctx.db
      .query("discoveries")
      .withIndex("by_workspace_firstSeen", (q) => q.eq("workspaceId", workspace._id).gte("firstSeenAt", since))
      .take(5000);

    return {
      period: range.period,
      label: range.label,
      range: period === "all" ? null : { start: range.current.start, end: range.current.end },
      previousRange: range.previous ? { start: range.previous.start, end: range.previous.end } : null,
      metric,
      receivedAllowed,
      rows,
      highlights: {
        total,
        prevTotal,
        givers,
        teamSize: active.length,
        participation: active.length ? givers / active.length : 0,
        rising: rows.filter((r) => (r.delta ?? 0) > 0).length,
        discoveries: found.length,
        legendaryFinds: found.filter((d) => d.rarity === "legendary").length,
        maxedDays: [...current.values()].reduce((s, t) => s + t.maxedDays, 0),
      },
      unit: { singular: workspace.unitSingular, plural: workspace.unitPlural, glyph: workspace.emojiGlyph },
      myRow: rows.find((r) => r.isMe) ?? null,
      truncated,
    };
  },
});
