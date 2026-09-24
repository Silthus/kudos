import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { usedOn } from "./engine";
import { categoryValidator, kudosSourceValidator, notificationCategoryValidator, rarityValidator } from "./schema";
import { canSeeReceived, requireViewer } from "./lib/access";
import { gameShownTo } from "./game";
import { gainLabel, gainsText, gainText } from "./lib/gains";
import { streaks } from "./lib/compare";
import { CATALOG, RARITIES, TEMPLATE_BY_KEY } from "./lib/messages";
import { resolvePeriod, type PeriodRange } from "./lib/periods";
import { rollupsReady } from "./lib/rebuild";
import { memberDays, median, rankBy, totalsByMember, workspaceDays, workspaceMembers } from "./lib/stats";
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

/** Latest bot messages read for Me's 5: enough that game DMs left out (hidden game) don't empty it. */
const MAX_BOT_MESSAGES_READ = 40;

/** A whole leap year: "year" charts every day, "all time" its most recent year. */
const MAX_CADENCE_DAYS = 366;

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const nullableNumber = v.union(v.number(), v.null());
const teammateTotal = v.union(v.object({ name: v.string(), amount: v.number() }), v.null());

/** Received values are null wherever `receivedVisibility` hides them from the viewer. */
const overviewValidator = v.object({
  periodLabel: v.string(),
  today: v.object({ used: v.number(), remaining: v.number(), limit: v.number() }),
  week: v.object({ given: v.number(), lastWeekGiven: v.number(), start: v.string(), end: v.string() }),
  totals: v.object({ given: v.number(), received: nullableNumber, maxedDays: v.number() }),
  period: v.object({ given: v.number(), prevGiven: nullableNumber, received: nullableNumber }),
  cadence: v.array(
    v.object({ day: v.string(), given: v.number(), received: nullableNumber, prevGiven: nullableNumber, prevReceived: nullableNumber }),
  ),
  patterns: v.object({
    teammatesCelebrated: v.number(),
    channelsVisited: v.number(),
    longestStreak: v.number(),
    currentStreak: v.number(),
    bestWeekday: v.union(v.string(), v.null()),
    topRecipient: teammateTotal,
    topSupporter: teammateTotal,
  }),
  discoveries: v.object({
    discovered: v.number(),
    total: v.number(),
    byRarity: v.array(v.object({ rarity: rarityValidator, total: v.number(), discovered: v.number() })),
    latest: v.array(
      v.object({
        key: v.string(),
        rarity: rarityValidator,
        category: categoryValidator,
        text: v.string(),
        timesSeen: v.number(),
        firstSeenAt: v.number(),
        lastSeenAt: v.number(),
      }),
    ),
  }),
  activity: v.array(
    v.object({
      _id: v.id("kudos"),
      direction: v.union(v.literal("given"), v.literal("received")),
      amount: v.number(),
      other: v.union(v.object({ name: v.string(), avatarUrl: v.optional(v.string()), slackUserId: v.string() }), v.null()),
      channel: v.union(v.string(), v.null()),
      text: v.string(),
      source: kudosSourceValidator,
      at: v.number(),
    }),
  ),
  botMessages: v.array(
    v.object({
      _id: v.id("notifications"),
      rarity: rarityValidator,
      category: notificationCategoryValidator,
      text: v.string(),
      isNewDiscovery: v.boolean(),
      at: v.number(),
      /** What the member gained in that event, when it rode along in a kudos DM (lib/gains.ts). */
      gains: v.optional(v.array(v.string())),
      /** A DM with gains: what it's about ("Level up", "New discovery", ...). */
      gainLabel: v.optional(v.string()),
    }),
  ),
});

/**
 * Everything on the "My Kudos" page that only the viewer's own activity changes: their own days,
 * pair rollups, kudos, discoveries and bot messages, plus the teammates those name. Where they stand
 * in the workspace (week rank, team median) is `standing`, which every give in the workspace re-runs.
 */
export const overview = query({
  args: {
    period: periodValidator,
    /** The client's current day in the workspace timezone (see `parseToday`). */
    today: v.string(),
  },
  returns: overviewValidator,
  handler: async (ctx, { period, today: todayArg }) => {
    const viewer = await requireViewer(ctx);
    const { member, workspace } = viewer;
    const tz = workspace.timezone;
    const today = parseToday(todayArg);
    const showReceived = canSeeReceived(viewer, member._id);
    const people = memberLookup(ctx);

    // Today
    const usedToday = await usedOn(ctx, member._id, today); // given, plus what waiting spree joins reserve (#94)

    // This week (Mon–today) vs the whole of last week
    const week = resolvePeriod("week", today);
    const weekDays = await memberDays(ctx, member._id, spanning(week.previous!, week.current));

    // Selected period: cadence + patterns. Like the week card, my total compares with the whole
    // previous bucket; the dashed daily overlay lines the previous bucket up day by day to date.
    const range = resolvePeriod(period, today);
    const previous = range.previousToDate;
    const current = period === "all" ? await allMyDays(ctx, member._id, today) : range.current;
    const charted = between(maxDay(current.start, addDays(current.end, 1 - MAX_CADENCE_DAYS)), current.end);
    // At most the charted days and the previous bucket: ≤ 2 × 366 rows.
    const days = await memberDays(ctx, member._id, range.previous ? spanning(range.previous, charted) : charted);
    const mineByDay = new Map(days.map((d) => [d.dayKey, d]));
    const cadenceDays = eachDay(charted);
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
    const periodGiven = period === "all" ? member.totalGiven : sumWithin(days, current, "given");
    const prevGiven = range.previous ? sumWithin(days, range.previous, "given") : null;
    const periodReceived = !showReceived ? null : period === "all" ? member.totalReceived : sumWithin(days, current, "received");

    // Kudos I gave inside the selected days, newest first so a capped read drops the oldest.
    const startTs = startOfDayUtc(current.start, tz);
    const endTs = startOfDayUtc(addDays(current.end, 1), tz);
    const givenRows = await ctx.db
      .query("kudos")
      .withIndex("by_giver_at", (q) => q.eq("giverId", member._id).gte("at", startTs).lt("at", endTs))
      .order("desc")
      .take(3000);
    const channels = new Set(givenRows.map((k) => k.channelName ?? k.channelId));

    // Who I celebrate and who celebrates me: exact pair rollups once they are backfilled, before
    // that my own kudos rows (the rollups then only hold what happened since they shipped).
    const ready = rollupsReady(workspace);
    const recipients = ready
      ? await pairTotals(ctx, "given", member._id, range.bucket)
      : sumBy(givenRows, (k) => k.receiverId);
    let supporters: Map<Id<"members">, number> | null = null;
    if (showReceived) {
      supporters = ready
        ? await pairTotals(ctx, "received", member._id, range.bucket)
        : sumBy(
            await ctx.db
              .query("kudos")
              .withIndex("by_receiver_at", (q) => q.eq("receiverId", member._id).gte("at", startTs).lt("at", endTs))
              .order("desc")
              .take(3000),
            (k) => k.giverId,
          );
    }

    const profile = await givingProfile(ctx, member, today);
    const bestWeekday = profile.byWeekday.some((n) => n > 0)
      ? WEEKDAY_NAMES[profile.byWeekday.indexOf(Math.max(...profile.byWeekday))]
      : null;

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
    const activity = [];
    for (const k of [...recentGiven, ...recentReceived].sort((a, b) => b.at - a.at).slice(0, 12)) {
      const direction = k.giverId === member._id ? ("given" as const) : ("received" as const);
      const other = await people(direction === "given" ? k.receiverId : k.giverId);
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

    // Game DMs (gains) are game UI: gone while the game is off or hidden, back with it. A discovery
    // gain repeats a message listed here already (its reply, marked new), so the web leaves it out.
    const showGame = gameShownTo(workspace, member);
    const gameOnly = (n: Doc<"notifications">) => n.category === "gains" || n.category === "level_up" || n.category === "garden";
    const shownGains = (n: Doc<"notifications">) => (showGame ? (n.gains ?? []).filter((g) => g.kind !== "discovery") : []);
    const notifications = (
      await ctx.db
        .query("notifications")
        .withIndex("by_member", (q) => q.eq("memberId", member._id))
        .order("desc")
        .take(MAX_BOT_MESSAGES_READ)
    )
      .filter((n) => !gameOnly(n) || (showGame && (!n.gains || shownGains(n).length > 0)))
      .slice(0, 5);

    return {
      periodLabel: range.label,
      today: { used: usedToday, remaining: Math.max(0, workspace.dailyLimit - usedToday), limit: workspace.dailyLimit },
      week: {
        given: sumWithin(weekDays, week.current, "given"),
        lastWeekGiven: sumWithin(weekDays, week.previous!, "given"),
        start: week.current.start,
        end: addDays(week.current.start, 6),
      },
      totals: {
        given: member.totalGiven,
        received: showReceived ? member.totalReceived : null,
        maxedDays: member.totalMaxedDays,
      },
      period: { given: periodGiven, prevGiven, received: periodReceived },
      cadence,
      patterns: {
        teammatesCelebrated: recipients.size,
        channelsVisited: channels.size,
        longestStreak: profile.longest,
        currentStreak: profile.current,
        bestWeekday,
        topRecipient: await topOf(recipients, people),
        topSupporter: supporters && (await topOf(supporters, people)),
      },
      discoveries: {
        discovered: discoveredKeys.size,
        total: CATALOG.length,
        byRarity,
        latest: latestDiscoveries,
      },
      activity,
      botMessages: notifications.map((n) => {
        const gains = shownGains(n);
        return {
          _id: n._id,
          rarity: n.rarity,
          category: n.category,
          text: gameOnly(n) && gains.length > 0 ? gainsText(gains, "web") : n.webText,
          isNewDiscovery: n.isNewDiscovery,
          at: n._creationTime,
          ...(gains.length > 0 ? { gainLabel: gainLabel(gains), ...(gameOnly(n) ? {} : { gains: gains.map((g) => gainText(g, "web")) }) } : {}),
          ...(n.category === "garden" ? { gainLabel: "Garden" } : {}),
        };
      }),
    };
  },
});

function between(start: string, end: string): DayRange {
  return { start, end, days: daysBetween(start, end) + 1 };
}

const maxDay = (a: string, b: string) => (a > b ? a : b);

/** The smallest range covering both. */
function spanning(a: DayRange, b: DayRange): DayRange {
  return between(a.start < b.start ? a.start : b.start, a.end > b.end ? a.end : b.end);
}

function sumWithin(days: Doc<"memberDays">[], r: DayRange, field: "given" | "received") {
  return days.reduce((sum, d) => (d.dayKey >= r.start && d.dayKey <= r.end ? sum + d[field] : sum), 0);
}

function sumBy(rows: Doc<"kudos">[], key: (k: Doc<"kudos">) => Id<"members">) {
  const out = new Map<Id<"members">, number>();
  for (const k of rows) out.set(key(k), (out.get(key(k)) ?? 0) + k.amount);
  return out;
}

/** "All time" for me: from my first recorded day (given or received) through today. */
async function allMyDays(ctx: QueryCtx, memberId: Id<"members">, today: string): Promise<DayRange> {
  const first = await ctx.db
    .query("memberDays")
    .withIndex("by_member_day", (q) => q.eq("memberId", memberId))
    .first();
  return between(first && first.dayKey < today ? first.dayKey : today, today);
}

/** My pair rollup for one bucket: teammate → units I gave them, or they gave me. */
async function pairTotals(ctx: QueryCtx, side: "given" | "received", memberId: Id<"members">, bucket: string) {
  // One row per teammate at most; all-zero rows are deleted.
  const rows =
    side === "given"
      ? await ctx.db
          .query("pairStats")
          .withIndex("by_giver_bucket_amount", (q) => q.eq("giverId", memberId).eq("bucket", bucket))
          .take(5000)
      : await ctx.db
          .query("pairStats")
          .withIndex("by_receiver_bucket_amount", (q) => q.eq("receiverId", memberId).eq("bucket", bucket))
          .take(5000);
  return new Map(rows.map((r) => [side === "given" ? r.receiverId : r.giverId, r.amount] as const));
}

type People = (id: Id<"members">) => Promise<Doc<"members"> | null>;

/** Member lookups shared across the page, each teammate read once. */
function memberLookup(ctx: QueryCtx): People {
  const cache = new Map<Id<"members">, Promise<Doc<"members"> | null>>();
  return (id) => {
    if (!cache.has(id)) cache.set(id, ctx.db.get(id));
    return cache.get(id)!;
  };
}

/**
 * The teammate with the most units; ties go to the id that sorts first. Only the winner is read:
 * each teammate read re-runs the page whenever that teammate gives or gets kudos.
 */
async function topOf(totals: Map<Id<"members">, number>, people: People) {
  let top: [Id<"members">, number] | null = null;
  for (const [id, n] of totals) if (n > 0 && (!top || n > top[1] || (n === top[1] && id < top[0]))) top = [id, n];
  const member = top && (await people(top[0]));
  return member && top ? { name: member.name, amount: top[1] } : null;
}

/**
 * My streaks and weekday sums. They are maintained on my member document with every give; a
 * member whose history predates that and who hasn't given since gets them from their days.
 */
async function givingProfile(ctx: QueryCtx, member: Doc<"members">, today: string) {
  if (member.totalGiven <= 0) return { longest: 0, current: 0, byWeekday: new Array<number>(7).fill(0) };
  if (member.givenByWeekday) {
    const last = member.lastActiveDay;
    return {
      longest: member.longestStreak ?? 0,
      current: last !== undefined && daysBetween(last, today) <= 1 ? (member.currentStreak ?? 0) : 0,
      byWeekday: member.givenByWeekday,
    };
  }
  const byWeekday = new Array<number>(7).fill(0);
  const active: string[] = [];
  // One row per day I gave or received: a few hundred a year.
  for await (const d of ctx.db.query("memberDays").withIndex("by_member_day", (q) => q.eq("memberId", member._id))) {
    if (d.given <= 0) continue;
    byWeekday[weekdayOfKey(d.dayKey)] += d.given;
    active.push(d.dayKey);
  }
  return { ...streaks(active, today), byWeekday };
}

/**
 * Where I stand in the workspace: my rank among this week's givers and my teammates' median given for
 * the selected period. Kept apart from `overview` because any give in the workspace changes it.
 */
export const standing = query({
  args: {
    period: periodValidator,
    /** The client's current day in the workspace timezone (see `parseToday`). */
    today: v.string(),
  },
  returns: v.object({
    week: v.object({ rank: v.union(v.number(), v.null()), of: v.number() }),
    teamMedian: v.number(),
  }),
  handler: async (ctx, { period, today: todayArg }) => {
    const { member, workspace } = await requireViewer(ctx);
    const today = parseToday(todayArg);
    const week = await givenByMember(ctx, workspace, resolvePeriod("week", today));
    const ranked = rankBy([...week.entries()], ([, given]) => given, ([id]) => id);
    const selected = period === "week" ? week : await givenByMember(ctx, workspace, resolvePeriod(period, today));
    // The rest of the team, as Compare's Team benchmark ("Compare in detail") counts it: not me,
    // and not the people who have left.
    const teammates = new Set(
      (await workspaceMembers(ctx, workspace._id)).filter((m) => !m.deactivated && m._id !== member._id).map((m) => m._id),
    );
    return {
      week: { rank: ranked.find(({ item: [id] }) => id === member._id)?.rank ?? null, of: ranked.length },
      teamMedian: median([...selected].filter(([id]) => teammates.has(id)).map(([, given]) => given)),
    };
  },
});

/** Units given per member in the period, for members who gave any: at most one row per member. */
async function givenByMember(ctx: QueryCtx, workspace: Doc<"workspaces">, range: PeriodRange) {
  const out = new Map<Id<"members">, number>();
  if (range.period === "all") {
    const members = await ctx.db
      .query("members")
      .withIndex("by_workspace_totalGiven", (q) => q.eq("workspaceId", workspace._id).gt("totalGiven", 0))
      .take(5000);
    for (const m of members) out.set(m._id, m.totalGiven);
  } else if (rollupsReady(workspace)) {
    const rows = await ctx.db
      .query("memberStats")
      .withIndex("by_workspace_bucket_given", (q) => q.eq("workspaceId", workspace._id).eq("bucket", range.bucket).gt("given", 0))
      .take(5000);
    for (const r of rows) out.set(r.memberId, r.given);
  } else {
    // Before the backfill the rollups only hold what happened since they shipped.
    const { rows } = await workspaceDays(ctx, workspace._id, range.current);
    for (const [id, totals] of totalsByMember(rows)) if (totals.given > 0) out.set(id, totals.given);
  }
  return out;
}

/** Small, cheap status for live widgets (allowance + collection size). */
export const today = query({
  args: {
    /** The client's current day in the workspace timezone (see `parseToday`). */
    today: v.string(),
  },
  returns: v.object({ used: v.number(), remaining: v.number(), limit: v.number(), discovered: v.number(), total: v.number() }),
  handler: async (ctx, { today }) => {
    const { member, workspace } = await requireViewer(ctx);
    const used = await usedOn(ctx, member._id, parseToday(today)); // given, plus what waiting spree joins reserve (#94)
    const discovered = await ctx.db
      .query("discoveries")
      .withIndex("by_member_template", (q) => q.eq("memberId", member._id))
      .take(500);
    return { used, remaining: Math.max(0, workspace.dailyLimit - used), limit: workspace.dailyLimit, discovered: discovered.length, total: CATALOG.length };
  },
});
