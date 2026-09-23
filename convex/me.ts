import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getMemberDay } from "./engine";
import { canSeeReceived, requireViewer } from "./lib/access";
import { streaks } from "./lib/compare";
import { CATALOG, RARITIES, TEMPLATE_BY_KEY } from "./lib/messages";
import { resolvePeriod } from "./lib/periods";
import { memberDays, median, rankBy, totalsByMember, workspaceDays } from "./lib/stats";
import {
  addDays,
  daysBetween,
  eachDay,
  parseToday,
  periodValidator,
  startOfDayUtc,
  weekdayOfKey,
  type DayRange,
} from "./lib/time";

/** A whole leap year: "year" charts every day, "all time" its most recent year. */
const MAX_CADENCE_DAYS = 366;

const WEEKDAY_NAMES =["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Everything on the "My Kudos" page. */
export const overview = query({
  args: {
    period: periodValidator,
    /** The client's current day in the workspace timezone (see `parseToday`). */
    today: v.string(),
  },
  handler: async (ctx, { period, today: todayArg }) => {
    const viewer = await requireViewer(ctx);
    const { member, workspace } = viewer;
    const tz = workspace.timezone;
    const today = parseToday(todayArg);
    const showReceived = canSeeReceived(viewer, member._id);

    // Today
    const todayRow = await getMemberDay(ctx, member._id, today);
    const usedToday = todayRow?.given ?? 0;

    // Weekly standing (Mon–today) vs last week
    const week = resolvePeriod("week", today);
    const { rows: weekRows } = await workspaceDays(ctx, workspace._id, week.current);
    const weekTotals = totalsByMember(weekRows);
    const ranked = rankBy(
      [...weekTotals.entries()].filter(([, t]) => t.given > 0),
      ([, t]) => t.given,
      ([id]) => id,
    );
    const myWeek = ranked.find(({ item: [id] }) => id === member._id);
    const lastWeekGiven = (await memberDays(ctx, member._id, week.previous!)).reduce((s, d) => s + d.given, 0);

    // Selected period: cadence + patterns. Like the week card, my total compares with the whole
    // previous bucket; the dashed daily overlay lines the previous bucket up day by day to date.
    const range = resolvePeriod(period, today);
    const previous = range.previousToDate;
    const allMine = await ctx.db
      .query("memberDays")
      .withIndex("by_member_day", (q) => q.eq("memberId", member._id))
      .take(2000);
    const mineByDay = new Map(allMine.map((d) => [d.dayKey, d]));
    const firstDay = allMine[0]?.dayKey ?? today;
    const current = period === "all" ? { start: firstDay, end: today, days: daysBetween(firstDay, today) + 1 } : range.current;
    const cadenceDays = eachDay(current).slice(-MAX_CADENCE_DAYS);
    const cadence = cadenceDays.map((day, i) => {
      const offset = i + (current.days - cadenceDays.length);
      const prevDay = previous && offset < previous.days ? addDays(previous.start, offset) : null;
      const cur = mineByDay.get(day);
      const prev = prevDay ? mineByDay.get(prevDay) : undefined;
      return {
        day,
        given: cur?.given ?? 0,
        received: showReceived ? (cur?.received ?? 0) : null,
        prevGiven: prevDay ? (prev?.given ?? 0) : null,
        prevReceived: prevDay && showReceived ? (prev?.received ?? 0) : null,
      };
    });
    // Totals cover the whole range even when the chart only shows its most recent days.
    const within = (r: DayRange) => allMine.filter((d) => d.dayKey >= r.start && d.dayKey <= r.end);
    const periodGiven = within(current).reduce((s, d) => s + d.given, 0);
    const prevGiven = range.previous ? within(range.previous).reduce((s, d) => s + d.given, 0) : null;
    const periodReceived = showReceived ? within(current).reduce((s, d) => s + d.received, 0) : null;

    // Kudos inside the selected days, newest first so a capped read drops the oldest.
    const startTs = startOfDayUtc(current.start, tz);
    const endTs = startOfDayUtc(addDays(current.end, 1), tz);
    const givenRows = await ctx.db
      .query("kudos")
      .withIndex("by_giver_at", (q) => q.eq("giverId", member._id).gte("at", startTs).lt("at", endTs))
      .order("desc")
      .take(3000);
    const recipientCounts = new Map<Id<"members">, number>();
    const channels = new Set<string>();
    for (const k of givenRows) {
      recipientCounts.set(k.receiverId, (recipientCounts.get(k.receiverId) ?? 0) + k.amount);
      channels.add(k.channelName ?? k.channelId);
    }
    const topRecipientEntry = [...recipientCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topRecipient = topRecipientEntry ? await ctx.db.get(topRecipientEntry[0]) : null;

    let topSupporter: { name: string; amount: number } | null = null;
    if (showReceived) {
      const receivedRows = await ctx.db
        .query("kudos")
        .withIndex("by_receiver_at", (q) => q.eq("receiverId", member._id).gte("at", startTs).lt("at", endTs))
        .order("desc")
        .take(3000);
      const byGiver = new Map<Id<"members">, number>();
      for (const k of receivedRows) byGiver.set(k.giverId, (byGiver.get(k.giverId) ?? 0) + k.amount);
      const top = [...byGiver.entries()].sort((a, b) => b[1] - a[1])[0];
      const m = top ? await ctx.db.get(top[0]) : null;
      if (m && top) topSupporter = { name: m.name, amount: top[1] };
    }

    const activeDayKeys = allMine.filter((d) => d.given > 0).map((d) => d.dayKey);
    const { longest, current: currentStreak } = streaks(activeDayKeys, today);
    const weekdayTotals = new Array(7).fill(0);
    for (const d of allMine) weekdayTotals[weekdayOfKey(d.dayKey)] += d.given;
    const bestWeekday = weekdayTotals.some((n) => n > 0) ? WEEKDAY_NAMES[weekdayTotals.indexOf(Math.max(...weekdayTotals))] : null;

    // Team comparison for the selected period (skipped for "all": we have totals).
    let teamMedian: number;
    if (period === "all") {
      const members = await ctx.db
        .query("members")
        .withIndex("by_workspace_totalGiven", (q) => q.eq("workspaceId", workspace._id).gt("totalGiven", 0))
        .take(5000);
      teamMedian = median(members.map((m) => m.totalGiven));
    } else {
      const { rows } = await workspaceDays(ctx, workspace._id, range.current);
      teamMedian = median([...totalsByMember(rows).values()].map((t) => t.given).filter((g) => g > 0));
    }

    // Discoveries
    const discoveries = await ctx.db
      .query("discoveries")
      .withIndex("by_member_lastSeen", (q) => q.eq("memberId", member._id))
      .order("desc")
      .take(500);
    const discoveredKeys = new Set(discoveries.map((d) => d.templateKey));
    const byRarity = RARITIES.map((rarity) => ({
      rarity,
      total: CATALOG.filter((t) => t.rarity === rarity).length,
      discovered: discoveries.filter((d) => d.rarity === rarity).length,
    }));
    const rarityOrder = (r: string) => RARITIES.indexOf(r as (typeof RARITIES)[number]);
    const latestDiscoveries = [...discoveries]
      .sort((a, b) => b.firstSeenAt - a.firstSeenAt)
      .slice(0, 12)
      .sort((a, b) => rarityOrder(b.rarity) - rarityOrder(a.rarity) || b.firstSeenAt - a.firstSeenAt)
      .slice(0, 4)
      .map((d) => ({
        key: d.templateKey,
        rarity: d.rarity,
        category: d.category,
        text: TEMPLATE_BY_KEY.get(d.templateKey)?.text ?? "",
        timesSeen: d.timesSeen,
        firstSeenAt: d.firstSeenAt,
        lastSeenAt: d.lastSeenAt,
      }));

    // Recent activity: given + (visible) received, newest first.
    const recentGiven = await ctx.db
      .query("kudos")
      .withIndex("by_giver_at", (q) => q.eq("giverId", member._id))
      .order("desc")
      .take(12);
    const recentReceived = showReceived
      ? await ctx.db
          .query("kudos")
          .withIndex("by_receiver_at", (q) => q.eq("receiverId", member._id))
          .order("desc")
          .take(12)
      : [];
    const names = new Map<Id<"members">, Doc<"members"> | null>();
    const nameOf = async (id: Id<"members">) => {
      if (!names.has(id)) names.set(id, await ctx.db.get(id));
      return names.get(id);
    };
    const activity = [];
    for (const k of [...recentGiven, ...recentReceived].sort((a, b) => b.at - a.at).slice(0, 12)) {
      const direction = k.giverId === member._id ? ("given" as const) : ("received" as const);
      const other = await nameOf(direction === "given" ? k.receiverId : k.giverId);
      activity.push({
        _id: k._id,
        direction,
        amount: k.amount,
        other: other ? { name: other.name, avatarUrl: other.avatarUrl, slackUserId: other.slackUserId } : null,
        channel: k.channelName ?? null,
        text: k.text,
        source: k.source,
        at: k.at,
      });
    }

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .order("desc")
      .take(5);

    return {
      periodLabel: range.label,
      today: { used: usedToday, remaining: Math.max(0, workspace.dailyLimit - usedToday), limit: workspace.dailyLimit },
      week: {
        rank: myWeek?.rank ?? null,
        of: ranked.length,
        given: weekTotals.get(member._id)?.given ?? 0,
        lastWeekGiven,
        start: week.current.start,
        end: addDays(week.current.start, 6),
      },
      totals: {
        given: member.totalGiven,
        received: showReceived ? member.totalReceived : null,
        maxedDays: member.totalMaxedDays,
      },
      period: { given: periodGiven, prevGiven, received: periodReceived, teamMedian },
      cadence,
      patterns: {
        teammatesCelebrated: recipientCounts.size,
        channelsVisited: channels.size,
        longestStreak: longest,
        currentStreak,
        bestWeekday,
        topRecipient: topRecipient && topRecipientEntry ? { name: topRecipient.name, amount: topRecipientEntry[1] } : null,
        topSupporter,
      },
      discoveries: {
        discovered: discoveredKeys.size,
        total: CATALOG.length,
        byRarity,
        latest: latestDiscoveries,
      },
      activity,
      botMessages: notifications.map((n) => ({
        _id: n._id,
        rarity: n.rarity,
        category: n.category,
        text: n.webText,
        isNewDiscovery: n.isNewDiscovery,
        at: n._creationTime,
      })),
    };
  },
});

/** Small, cheap status for live widgets (allowance + collection size). */
export const today = query({
  args: {
    /** The client's current day in the workspace timezone (see `parseToday`). */
    today: v.string(),
  },
  returns: v.object({ used: v.number(), remaining: v.number(), limit: v.number(), discovered: v.number(), total: v.number() }),
  handler: async (ctx, { today }) => {
    const { member, workspace } = await requireViewer(ctx);
    const row = await getMemberDay(ctx, member._id, parseToday(today));
    const used = row?.given ?? 0;
    const discovered = await ctx.db
      .query("discoveries")
      .withIndex("by_member_template", (q) => q.eq("memberId", member._id))
      .take(500);
    return { used, remaining: Math.max(0, workspace.dailyLimit - used), limit: workspace.dailyLimit, discovered: discovered.length, total: CATALOG.length };
  },
});
