import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireViewer } from "./lib/access";
import { RARITIES } from "./lib/messages";
import { kudosInRange, totalsByMember, workspaceDays, workspaceMembers } from "./lib/stats";
import { eachDay, periodValidator, resolvePeriod, startOfDayUtc, addDays, zonedParts, dayKeyFor, daysBetween } from "./lib/time";

/** Organisation-wide recognition analytics. */
export const overview = query({
  args: { period: periodValidator },
  handler: async (ctx, { period }) => {
    const viewer = await requireViewer(ctx);
    const { workspace } = viewer;
    const tz = workspace.timezone;
    const now = Date.now();
    // "All time" analytics are capped to the last 365 days to keep reads bounded.
    const range = resolvePeriod(period === "all" ? "90d" : period, now, tz);
    const current = period === "all"
      ? { start: addDays(dayKeyFor(now, tz), -364), end: dayKeyFor(now, tz), days: 365 }
      : range.current;
    const previous = period === "all" ? null : range.previous;
    const showPeople = workspace.receivedVisibility === "everyone";

    const members = await workspaceMembers(ctx, workspace._id);
    const active = members.filter((m) => !m.deactivated);
    const byId = new Map(members.map((m) => [m._id, m]));

    const curDays = await workspaceDays(ctx, workspace._id, current);
    const prevDays = previous ? await workspaceDays(ctx, workspace._id, previous) : null;
    const curRows = curDays.rows;
    const prevRows = prevDays?.rows ?? [];
    const cur = totalsByMember(curRows);
    const prev = totalsByMember(prevRows);

    const sum = (m: Map<Id<"members">, { given: number }>) => [...m.values()].reduce((s, t) => s + t.given, 0);
    const total = sum(cur);
    const prevTotal = previous ? sum(prev) : null;
    const givers = [...cur.entries()].filter(([, t]) => t.given > 0);
    const prevGivers = [...prev.entries()].filter(([, t]) => t.given > 0);
    const receivers = [...cur.values()].filter((t) => t.received > 0).length;
    const giverDays = curRows.filter((r) => r.given > 0);
    const allowanceUse = giverDays.length
      ? giverDays.reduce((s, r) => s + Math.min(r.given, workspace.dailyLimit), 0) / (giverDays.length * workspace.dailyLimit)
      : 0;

    // Daily volume, with the previous period aligned day-by-day.
    const dailyMap = new Map<string, number>();
    for (const r of curRows) dailyMap.set(r.dayKey, (dailyMap.get(r.dayKey) ?? 0) + r.given);
    const prevDailyMap = new Map<string, number>();
    for (const r of prevRows) prevDailyMap.set(r.dayKey, (prevDailyMap.get(r.dayKey) ?? 0) + r.given);
    const daily = eachDay(current).map((day, i) => ({
      day,
      total: dailyMap.get(day) ?? 0,
      prevTotal: previous ? (prevDailyMap.get(addDays(previous.start, i)) ?? 0) : null,
    }));

    // When recognition happens + where.
    const { rows, truncated: kudosTruncated } = await kudosInRange(
      ctx,
      workspace._id,
      startOfDayUtc(current.start, tz),
      startOfDayUtc(addDays(current.end, 1), tz),
    );
    const heatmap = Array.from({ length: 7 }, () => new Array(24).fill(0) as number[]);
    const channels = new Map<string, number>();
    const sources = new Map<string, number>();
    const pairs = new Map<string, number>();
    const batches = new Set<string>();
    for (const k of rows) {
      const p = zonedParts(k.at, tz);
      heatmap[p.weekday][p.hour] += k.amount;
      const ch = k.channelName ?? k.channelId;
      channels.set(ch, (channels.get(ch) ?? 0) + k.amount);
      const src = k.source === "reaction" ? "Reactions" : "Messages";
      sources.set(src, (sources.get(src) ?? 0) + k.amount);
      const key = `${k.giverId}|${k.receiverId}`;
      pairs.set(key, (pairs.get(key) ?? 0) + k.amount);
      batches.add(k.batchId);
    }

    // How concentrated is giving? Share of kudos coming from the top 20% of givers.
    const giverTotals = givers.map(([, t]) => t.given).sort((a, b) => b - a);
    const topN = Math.max(1, Math.ceil(giverTotals.length * 0.2));
    const topShare = total ? giverTotals.slice(0, topN).reduce((s, n) => s + n, 0) / total : 0;

    const prevGiverIds = new Set(prevGivers.map(([id]) => id));
    const newGivers = givers.filter(([id]) => !prevGiverIds.has(id)).length;
    const retained = givers.filter(([id]) => prevGiverIds.has(id)).length;

    const person = (id: Id<"members">) => {
      const m = byId.get(id);
      return m ? { _id: m._id, name: m.name, avatarUrl: m.avatarUrl ?? null, slackUserId: m.slackUserId } : null;
    };
    const topGivers = givers
      .sort((a, b) => b[1].given - a[1].given)
      .slice(0, 5)
      .map(([id, t]) => ({ member: person(id), value: t.given }));
    const topReceivers = showPeople
      ? [...cur.entries()]
          .filter(([, t]) => t.received > 0)
          .sort((a, b) => b[1].received - a[1].received)
          .slice(0, 5)
          .map(([id, t]) => ({ member: person(id), value: t.received }))
      : null;
    const topPairs = showPeople
      ? [...pairs.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([key, value]) => {
            const [g, r] = key.split("|") as [Id<"members">, Id<"members">];
            return { giver: person(g), receiver: person(r), value };
          })
      : null;

    const discoveries = await ctx.db
      .query("discoveries")
      .withIndex("by_workspace_firstSeen", (q) =>
        q.eq("workspaceId", workspace._id).gte("firstSeenAt", startOfDayUtc(current.start, tz)),
      )
      .take(2000);

    return {
      label: period === "all" ? "Last 365 days" : range.label,
      range: { start: current.start, end: current.end, days: daysBetween(current.start, current.end) + 1 },
      showPeople,
      unit: { glyph: workspace.emojiGlyph, singular: workspace.unitSingular, plural: workspace.unitPlural },
      kpis: {
        total,
        prevTotal,
        givers: givers.length,
        prevGivers: previous ? prevGivers.length : null,
        receivers,
        teamSize: active.length,
        participation: active.length ? givers.length / active.length : 0,
        prevParticipation: previous && active.length ? prevGivers.length / active.length : null,
        avgPerGiver: givers.length ? total / givers.length : 0,
        allowanceUse,
        messages: batches.size,
        maxedDays: curRows.filter((r) => r.maxed).length,
        topShare,
        newGivers,
        retained,
      },
      daily,
      heatmap,
      channels: [...channels.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value })),
      sources: [...sources.entries()].map(([name, value]) => ({ name, value })),
      topGivers,
      topReceivers,
      topPairs,
      rarity: RARITIES.map((r) => ({ rarity: r, value: discoveries.filter((d) => d.rarity === r).length })),
      truncated: curDays.truncated || (prevDays?.truncated ?? false) || kudosTruncated,
    };
  },
});
