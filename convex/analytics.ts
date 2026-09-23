import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireViewer } from "./lib/access";
import { dayBucket, monthBucket } from "./lib/buckets";
import { RARITIES, type Rarity } from "./lib/messages";
import { resolvePeriod, type PeriodRange } from "./lib/periods";
import { channelKey, zeroFound } from "./lib/rollups";
import {
  backfilledRollups,
  kudosInRange,
  totalsByMember,
  workspaceDays,
  workspaceMembers,
  memberBucket,
  workspaceBucket,
  workspaceStatsBetween,
} from "./lib/stats";
import {
  addDays,
  daysBetween,
  eachDay,
  parseToday,
  periodValidator,
  startOfDayUtc,
  weekdayOfKey,
  zonedParts,
  type DayRange,
  type Period,
} from "./lib/time";

/** Organisation-wide recognition analytics. */
export const overview = query({
  args: {
    period: periodValidator,
    /** The client's current day in the workspace timezone (see `parseToday`). */
    today: v.string(),
  },
  handler: async (ctx, { period, today }) => {
    const { workspace } = await requireViewer(ctx);
    return await overviewFor(ctx, workspace, period, parseToday(today));
  },
});

/**
 * Analytics for `period` up to `today`. Once the workspace's rollups are backfilled every section
 * comes from them: ~1.6k small documents for a month and ≤2.4k for a year at 500 members, all
 * exact. Before that it falls back to scanning `memberDays`/`kudos`, capped and flagged `truncated`.
 *
 * Comparisons: volume (the "Kudos given" KPI and the chart overlay) against the previous bucket up
 * to the same day; givers, participation and new/retained against the whole previous bucket, the
 * only exact distinct count the rollups hold. All time charts whole months and has no comparison.
 */
export async function overviewFor(ctx: QueryCtx, workspace: Doc<"workspaces">, period: Period, today: string) {
  const range = resolvePeriod(period, today);
  const members = await workspaceMembers(ctx, workspace._id);
  const showPeople = workspace.receivedVisibility === "everyone";
  const rollups = await backfilledRollups(ctx, workspace._id);
  const facts = rollups
    ? await fromRollups(ctx, workspace, range, rollups, members, showPeople)
    : await fromSources(ctx, workspace, range, members);
  return present(workspace, range, members, showPeople, facts);
}

type Counts = Pick<
  Doc<"workspaceStats">,
  "given" | "messages" | "givers" | "receivers" | "giverDays" | "cappedGiven" | "maxedDays" | "fromReactions" | "fromMessages"
>;

/** What both sources deliver; `present` turns it into the page. */
type Facts = {
  /** First day shown: the bucket's first day, or the first active day for all time. */
  start: string;
  counts: Counts;
  /** 7 × 24 units, Monday-major. */
  heat: number[];
  found: Record<Rarity, number>;
  /** Units per day key, or per month (keyed by its first day) for all time. */
  volume: Map<string, number>;
  /** Units per day of the previous bucket up to the same day; null for all time. */
  prevVolume: Map<string, number> | null;
  /** Per member in the current bucket: members with any activity. */
  totals: Map<Id<"members">, { given: number; received: number }>;
  /** Everyone who gave in the whole previous bucket; null for all time. */
  prevGivers: Set<Id<"members">> | null;
  /** Channel candidates (at least the top 8). */
  channels: { name: string; value: number }[];
  /** Pair candidates (at least the top 6); only read when received kudos are public. */
  pairs: { giverId: Id<"members">; receiverId: Id<"members">; value: number }[];
  truncated: boolean;
};

const TOP_CHANNELS = 8;
const TOP_PAIRS = 6;
const TOP_PEOPLE = 5;
/** Bounds a bucket's member rows; `workspaceMembers` reads no more members than this either. */
const MAX_MEMBERS = 5_000;

const monthStart = (dayKey: string) => `${dayKey.slice(0, 7)}-01`;

/** First days of every month from `start`'s through `end`'s. */
function eachMonth(start: string, end: string) {
  const out: string[] = [];
  // 31 days after the 1st always lands in the next month.
  for (let month = monthStart(start); month <= end; month = monthStart(addDays(month, 31))) out.push(month);
  return out;
}

/** Ties at the cut beyond this many rows fall back to index order. */
const MAX_TIED = 50;

/**
 * The top `n` rows by amount, plus the rows tied with the last of them, so that `present` can break
 * the tie by name instead of by row creation order. `read(amount, limit)` reads a bucket's rows by
 * amount, descending; with an amount, only the rows of exactly that amount.
 */
async function topByAmount<R extends { amount: number }>(n: number, read: (amount: number | null, limit: number) => Promise<R[]>) {
  const top = await read(null, n);
  if (top.length < n) return top;
  const cut = top[n - 1].amount;
  return [...top.filter((r) => r.amount > cut), ...(await read(cut, MAX_TIED))];
}

/**
 * The first day anyone gave, up to `today`. Day rows can also exist for bot messages alone (their
 * discoveries), so look for the first month with kudos (≤12 rows a year), then its first day.
 */
async function firstGivingDay(ctx: QueryCtx, workspaceId: Id<"workspaces">, today: string) {
  const months = ctx.db
    .query("workspaceStats")
    .withIndex("by_workspace_bucket", (q) => q.eq("workspaceId", workspaceId).gte("bucket", "m:").lte("bucket", monthBucket(today)));
  for await (const month of months) {
    if (month.given <= 0) continue;
    const key = month.bucket.slice(2);
    const days = await workspaceStatsBetween(ctx, workspaceId, dayBucket(`${key}-01`), dayBucket(`${key}-31`));
    const day = days.find((d) => d.given > 0 && d.bucket <= dayBucket(today));
    if (day) return day.bucket.slice(2);
  }
  return null;
}

async function fromRollups(
  ctx: QueryCtx,
  workspace: Doc<"workspaces">,
  range: PeriodRange,
  all: Doc<"workspaceStats">,
  members: Doc<"members">[],
  showPeople: boolean,
): Promise<Facts> {
  const wsId = workspace._id;
  const today = range.current.end;
  const topChannels = await topByAmount(TOP_CHANNELS, (amount, limit) =>
    ctx.db
      .query("channelStats")
      .withIndex("by_workspace_bucket_amount", (q) => {
        const inBucket = q.eq("workspaceId", wsId).eq("bucket", range.bucket);
        return amount === null ? inBucket : inBucket.eq("amount", amount);
      })
      .order("desc")
      .take(limit),
  );
  const channels = topChannels.map((c) => ({ name: c.channel, value: c.amount }));
  const topPairs = showPeople
    ? await topByAmount(TOP_PAIRS, (amount, limit) =>
        ctx.db
          .query("pairStats")
          .withIndex("by_workspace_bucket_amount", (q) => {
            const inBucket = q.eq("workspaceId", wsId).eq("bucket", range.bucket);
            return amount === null ? inBucket : inBucket.eq("amount", amount);
          })
          .order("desc")
          .take(limit),
      )
    : [];
  const pairs = topPairs.map((p) => ({ giverId: p.giverId, receiverId: p.receiverId, value: p.amount }));
  const byKey = (rows: Doc<"workspaceStats">[]) => new Map(rows.map((r) => [r.bucket.slice(2), r.given]));

  if (range.period === "all") {
    const start = (await firstGivingDay(ctx, wsId, today)) ?? today;
    const months = await workspaceStatsBetween(ctx, wsId, monthBucket(start), monthBucket(today));
    return {
      start,
      counts: all,
      heat: all.heat,
      found: all.found,
      volume: new Map([...byKey(months)].map(([month, given]) => [`${month}-01`, given])),
      prevVolume: null,
      // Per-member all time lives on the member itself.
      totals: new Map(
        members
          .filter((m) => m.totalGiven > 0 || m.totalReceived > 0)
          .map((m) => [m._id, { given: m.totalGiven, received: m.totalReceived }]),
      ),
      prevGivers: null,
      channels,
      pairs,
      truncated: false,
    };
  }

  const { current, previousToDate } = range;
  const bucket = await workspaceBucket(ctx, wsId, range.bucket);
  const days = await workspaceStatsBetween(ctx, wsId, dayBucket(current.start), dayBucket(current.end));
  const prevDays = previousToDate
    ? await workspaceStatsBetween(ctx, wsId, dayBucket(previousToDate.start), dayBucket(previousToDate.end))
    : [];
  const memberRows = await ctx.db
    .query("memberStats")
    .withIndex("by_workspace_bucket_given", (q) => q.eq("workspaceId", wsId).eq("bucket", range.bucket))
    .order("desc") // past the cap, the smallest givers are the ones left out
    .take(MAX_MEMBERS);
  const prevGiverRows = range.previousBucket ? await memberBucket(ctx, wsId, range.previousBucket, "given", MAX_MEMBERS) : [];
  return {
    start: current.start,
    counts: bucket ?? { given: 0, messages: 0, givers: 0, receivers: 0, giverDays: 0, cappedGiven: 0, maxedDays: 0, fromReactions: 0, fromMessages: 0 },
    heat: bucket?.heat ?? new Array<number>(7 * 24).fill(0),
    found: bucket?.found ?? zeroFound(),
    volume: byKey(days),
    prevVolume: byKey(prevDays),
    totals: new Map(memberRows.map((m) => [m.memberId, { given: m.given, received: m.received }])),
    prevGivers: new Set(prevGiverRows.map((m) => m.memberId)),
    channels,
    pairs,
    truncated: memberRows.length === MAX_MEMBERS || prevGiverRows.length === MAX_MEMBERS,
  };
}

/** The legacy computation from the source tables, for workspaces whose rollups aren't backfilled yet. */
async function fromSources(
  ctx: QueryCtx,
  workspace: Doc<"workspaces">,
  range: PeriodRange,
  members: Doc<"members">[],
): Promise<Facts> {
  const tz = workspace.timezone;
  const today = range.current.end;
  // "All time" starts at the workspace's first recorded day.
  const start = range.period === "all"
    ? (await ctx.db
        .query("memberDays")
        .withIndex("by_workspace_day", (q) => q.eq("workspaceId", workspace._id).lte("dayKey", today))
        .first())?.dayKey ?? today
    : range.current.start;
  const current: DayRange = { start, end: today, days: daysBetween(start, today) + 1 };
  const curDays = await workspaceDays(ctx, workspace._id, current);
  const prevDays = range.previous ? await workspaceDays(ctx, workspace._id, range.previous) : null;

  const counts: Counts = { given: 0, messages: 0, givers: 0, receivers: 0, giverDays: 0, cappedGiven: 0, maxedDays: 0, fromReactions: 0, fromMessages: 0 };
  const volume = new Map<string, number>();
  const volumeKey = range.period === "all" ? monthStart : (day: string) => day;
  for (const r of curDays.rows) {
    counts.given += r.given;
    if (r.given > 0) {
      counts.giverDays += 1;
      counts.cappedGiven += r.capped ?? Math.min(r.given, workspace.dailyLimit);
    }
    if (r.maxed) counts.maxedDays += 1;
    volume.set(volumeKey(r.dayKey), (volume.get(volumeKey(r.dayKey)) ?? 0) + r.given);
  }
  let totals = new Map([...totalsByMember(curDays.rows)].map(([id, t]) => [id, { given: t.given, received: t.received }]));
  if (range.period === "all") {
    // All-time per-member totals are exact on the members themselves, however long the history.
    totals = new Map(
      members
        .filter((m) => m.totalGiven > 0 || m.totalReceived > 0)
        .map((m) => [m._id, { given: m.totalGiven, received: m.totalReceived }]),
    );
    counts.given = members.reduce((n, m) => n + m.totalGiven, 0);
    counts.maxedDays = members.reduce((n, m) => n + m.totalMaxedDays, 0);
  }
  counts.givers = [...totals.values()].filter((t) => t.given > 0).length;
  counts.receivers = [...totals.values()].filter((t) => t.received > 0).length;

  let prevVolume: Map<string, number> | null = null;
  let prevGivers: Set<Id<"members">> | null = null;
  if (prevDays && range.previousToDate) {
    prevVolume = new Map();
    prevGivers = new Set();
    for (const r of prevDays.rows) {
      if (r.given > 0) prevGivers.add(r.memberId);
      if (r.dayKey <= range.previousToDate.end) prevVolume.set(r.dayKey, (prevVolume.get(r.dayKey) ?? 0) + r.given);
    }
  }

  const { rows, truncated: kudosTruncated } = await kudosInRange(
    ctx,
    workspace._id,
    startOfDayUtc(current.start, tz),
    startOfDayUtc(addDays(current.end, 1), tz),
  );
  const heat = new Array<number>(7 * 24).fill(0);
  const channels = new Map<string, number>();
  const pairs = new Map<string, { giverId: Id<"members">; receiverId: Id<"members">; value: number }>();
  const batches = new Set<string>();
  for (const k of rows) {
    heat[weekdayOfKey(k.dayKey) * 24 + (k.hour ?? zonedParts(k.at, tz).hour)] += k.amount;
    channels.set(channelKey(k), (channels.get(channelKey(k)) ?? 0) + k.amount);
    if (k.source === "reaction") counts.fromReactions += k.amount;
    else counts.fromMessages += k.amount;
    const pair = pairs.get(`${k.giverId}|${k.receiverId}`) ?? { giverId: k.giverId, receiverId: k.receiverId, value: 0 };
    pair.value += k.amount;
    pairs.set(`${k.giverId}|${k.receiverId}`, pair);
    batches.add(k.batchId);
  }
  counts.messages = batches.size;

  // All time counts every discovery, even from bot messages before the first kudos.
  const since = range.period === "all" ? 0 : startOfDayUtc(current.start, tz);
  const discoveries = await ctx.db
    .query("discoveries")
    .withIndex("by_workspace_firstSeen", (q) => q.eq("workspaceId", workspace._id).gte("firstSeenAt", since))
    .take(2000);
  const found = Object.fromEntries(RARITIES.map((r) => [r, discoveries.filter((d) => d.rarity === r).length])) as Record<Rarity, number>;

  return {
    start,
    counts,
    heat,
    found,
    volume,
    prevVolume,
    totals,
    prevGivers,
    channels: [...channels].map(([name, value]) => ({ name, value })),
    pairs: [...pairs.values()],
    truncated: curDays.truncated || (prevDays?.truncated ?? false) || kudosTruncated || discoveries.length === 2000,
  };
}

function present(
  workspace: Doc<"workspaces">,
  range: PeriodRange,
  members: Doc<"members">[],
  showPeople: boolean,
  facts: Facts,
) {
  const { counts, totals, prevGivers, prevVolume } = facts;
  const previous = range.previousToDate;
  const end = range.current.end;
  const byId = new Map(members.map((m) => [m._id, m]));
  const name = (id: Id<"members">) => byId.get(id)?.name ?? "";
  const person = (id: Id<"members">) => {
    const m = byId.get(id);
    return m ? { _id: m._id, name: m.name, avatarUrl: m.avatarUrl ?? null, slackUserId: m.slackUserId } : null;
  };
  const teamSize = members.filter((m) => !m.deactivated).length;

  // Largest first; ties by name, so the lists don't reshuffle between runs.
  const ranked = (metric: "given" | "received") =>
    [...totals]
      .filter(([, t]) => t[metric] > 0)
      .sort(([a, ta], [b, tb]) => tb[metric] - ta[metric] || name(a).localeCompare(name(b)));
  const givers = ranked("given");

  // To date: a client still on yesterday doesn't count what the bucket got after it.
  const total = range.period === "all" ? counts.given : [...facts.volume.values()].reduce((s, n) => s + n, 0);
  const prevTotal = prevVolume ? [...prevVolume.values()].reduce((s, n) => s + n, 0) : null;
  // How concentrated is giving? Share of kudos coming from the top 20% of givers.
  const topN = Math.max(1, Math.ceil(givers.length * 0.2));
  const topShare = total ? givers.slice(0, topN).reduce((s, [, t]) => s + t.given, 0) / total : 0;
  const retained = prevGivers ? givers.filter(([id]) => prevGivers.has(id)).length : 0;

  const volume =
    range.period === "all"
      ? eachMonth(facts.start, end).map((day) => ({ day, total: facts.volume.get(day) ?? 0, prevTotal: null }))
      : eachDay(range.current).map((day, i) => ({
          day,
          total: facts.volume.get(day) ?? 0,
          // Past the end of a shorter previous bucket (Feb vs. Mar 29–31) there is nothing to compare.
          prevTotal: previous && prevVolume ? (i < previous.days ? (prevVolume.get(addDays(previous.start, i)) ?? 0) : null) : null,
        }));

  return {
    period: range.period,
    label: range.label,
    range: { start: facts.start, end, days: daysBetween(facts.start, end) + 1 },
    showPeople,
    unit: { glyph: workspace.emojiGlyph, singular: workspace.unitSingular, plural: workspace.unitPlural },
    kpis: {
      total,
      prevTotal,
      givers: counts.givers,
      prevGivers: prevGivers ? prevGivers.size : null,
      receivers: counts.receivers,
      teamSize,
      participation: teamSize ? counts.givers / teamSize : 0,
      prevParticipation: prevGivers && teamSize ? prevGivers.size / teamSize : null,
      avgPerGiver: counts.givers ? total / counts.givers : 0,
      // Allowance in force when each kudos was given, over today's limit; capped at a full 100%.
      allowanceUse: counts.giverDays ? Math.min(1, counts.cappedGiven / (counts.giverDays * workspace.dailyLimit)) : 0,
      messages: counts.messages,
      maxedDays: counts.maxedDays,
      topShare,
      newGivers: givers.length - retained,
      retained,
    },
    grain: range.period === "all" ? ("month" as const) : ("day" as const),
    volume,
    heatmap: Array.from({ length: 7 }, (_, day) => facts.heat.slice(day * 24, day * 24 + 24)),
    channels: [...facts.channels]
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
      .slice(0, TOP_CHANNELS),
    sources: [
      { name: "Messages", value: counts.fromMessages },
      { name: "Reactions", value: counts.fromReactions },
    ].filter((s) => s.value > 0),
    topGivers: givers.slice(0, TOP_PEOPLE).map(([id, t]) => ({ member: person(id), value: t.given })),
    topReceivers: showPeople
      ? ranked("received").slice(0, TOP_PEOPLE).map(([id, t]) => ({ member: person(id), value: t.received }))
      : null,
    topPairs: showPeople
      ? [...facts.pairs]
          .sort((a, b) => b.value - a.value || name(a.giverId).localeCompare(name(b.giverId)) || name(a.receiverId).localeCompare(name(b.receiverId)))
          .slice(0, TOP_PAIRS)
          .map((p) => ({ giver: person(p.giverId), receiver: person(p.receiverId), value: p.value }))
      : null,
    rarity: RARITIES.map((r) => ({ rarity: r, value: facts.found[r] })),
    truncated: facts.truncated,
  };
}
