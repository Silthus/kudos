import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { ALL_BUCKET, dayBucket } from "./buckets";
import { RARITIES } from "./messages";
import type { PeriodRange } from "./periods";
import type { DayRange } from "./time";

/**
 * Upper bound on rollup rows read per range, sized so the heaviest query (analytics:
 * two ranges + kudos sample + discoveries) stays well under Convex's per-query read limit.
 */
const MAX_DAY_ROWS = 5_000;

export type Bounded<T> = { rows: T[]; truncated: boolean };

/** Rollup rows in a range, newest first, so a truncated read drops the oldest days. */
export async function workspaceDays(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  range: DayRange,
  cap = MAX_DAY_ROWS,
): Promise<Bounded<Doc<"memberDays">>> {
  const rows = await ctx.db
    .query("memberDays")
    .withIndex("by_workspace_day", (q) =>
      q.eq("workspaceId", workspaceId).gte("dayKey", range.start).lte("dayKey", range.end),
    )
    .order("desc")
    .take(cap);
  return { rows, truncated: rows.length === cap };
}

export async function memberDays(ctx: QueryCtx, memberId: Id<"members">, range: DayRange) {
  return await ctx.db
    .query("memberDays")
    .withIndex("by_member_day", (q) =>
      q.eq("memberId", memberId).gte("dayKey", range.start).lte("dayKey", range.end),
    )
    .take(1000);
}

export type Totals = { given: number; received: number; maxedDays: number; activeDays: number };

export function totalsByMember(rows: Doc<"memberDays">[]) {
  const out = new Map<Id<"members">, Totals>();
  for (const r of rows) {
    const t = out.get(r.memberId) ?? { given: 0, received: 0, maxedDays: 0, activeDays: 0 };
    t.given += r.given;
    t.received += r.received;
    if (r.maxed) t.maxedDays += 1;
    if (r.given > 0) t.activeDays += 1;
    out.set(r.memberId, t);
  }
  return out;
}

/** Upper bound on members read per workspace; the read models are sized for ~500. */
const MAX_MEMBERS = 5_000;

export async function workspaceMembers(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const rows = await ctx.db
    .query("members")
    .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspaceId))
    .take(MAX_MEMBERS);
  return rows.filter((m) => !m.isBot);
}

/**
 * The team a period's participation is measured against: everyone still here, plus whoever gave
 * in the period and has left since (they were on the team then). A giver `members` doesn't list
 * (since marked a bot, mid-removal) still counts, so it never has fewer people than gave, and
 * participation (givers / team size) stays within 100%.
 */
export function teamSize(members: Doc<"members">[], givers: number, departedGivers: number) {
  return Math.max(members.filter((m) => !m.deactivated).length + departedGivers, givers);
}

/** How many of `givers` have left the workspace (are deactivated). */
export function departedAmong(members: Doc<"members">[], givers: Iterable<Id<"members">>) {
  const departed = new Set(members.filter((m) => m.deactivated).map((m) => m._id));
  let n = 0;
  for (const id of givers) if (departed.has(id)) n++;
  return n;
}

/**
 * The workspace's `all` rollup row once its backfill has finished (`rollupsBackfilledAt`), else
 * null. Readers use the rollups only then, and their legacy computation before.
 */
export async function backfilledRollups(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const rows = await ctx.db
    .query("workspaceStats")
    .withIndex("by_workspace_bucket", (q) => q.eq("workspaceId", workspaceId).eq("bucket", ALL_BUCKET))
    .take(2);
  return rows.find((r) => r.rollupsBackfilledAt !== undefined) ?? null;
}

export async function workspaceBucket(ctx: QueryCtx, workspaceId: Id<"workspaces">, bucket: string) {
  return await ctx.db
    .query("workspaceStats")
    .withIndex("by_workspace_bucket", (q) => q.eq("workspaceId", workspaceId).eq("bucket", bucket))
    .first();
}

/** `workspaceStats` rows keyed from `from` to `to` inclusive: one kind of key (`d:` or `m:`), in date order. */
export async function workspaceStatsBetween(ctx: QueryCtx, workspaceId: Id<"workspaces">, from: string, to: string) {
  return await ctx.db
    .query("workspaceStats")
    .withIndex("by_workspace_bucket", (q) => q.eq("workspaceId", workspaceId).gte("bucket", from).lte("bucket", to))
    .take(1_200); // a leap year of days, or a century of months
}

/** Units given in the workspace over a day range, summed from its `d:` rollup rows (≤366). */
export async function givenOverDays(ctx: QueryCtx, workspaceId: Id<"workspaces">, range: DayRange) {
  const days = await ctx.db
    .query("workspaceStats")
    .withIndex("by_workspace_bucket", (q) =>
      q.eq("workspaceId", workspaceId).gte("bucket", dayBucket(range.start)).lte("bucket", dayBucket(range.end)),
    )
    .take(range.days);
  return days.reduce((s, d) => s + d.given, 0);
}

/** The members' rollup rows in a w/m/q/y bucket with a positive `metric`, highest first. */
export async function memberBucket(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  bucket: string,
  metric: "given" | "received",
  limit = MAX_MEMBERS,
) {
  const rows =
    metric === "given"
      ? ctx.db
          .query("memberStats")
          .withIndex("by_workspace_bucket_given", (q) => q.eq("workspaceId", workspaceId).eq("bucket", bucket).gt("given", 0))
      : ctx.db
          .query("memberStats")
          .withIndex("by_workspace_bucket_received", (q) =>
            q.eq("workspaceId", workspaceId).eq("bucket", bucket).gt("received", 0),
          );
  return await rows.order("desc").take(limit);
}

/**
 * Every member's totals for a w/m/q/y period to date: their `memberStats` rows for its bucket (at most
 * one per member; the bucket holds nothing after today) once the workspace's rollups are backfilled,
 * before that its `memberDays`, capped, with `truncated` when the cap was hit.
 */
export async function memberTotalsInRange(
  ctx: QueryCtx,
  workspace: Doc<"workspaces">,
  range: PeriodRange,
  dayCap = MAX_DAY_ROWS,
): Promise<{ totals: Map<Id<"members">, Totals>; truncated: boolean }> {
  if (workspace.rollupsBackfilledAt !== undefined) {
    const rows = await ctx.db
      .query("memberStats")
      .withIndex("by_workspace_bucket_given", (q) => q.eq("workspaceId", workspace._id).eq("bucket", range.bucket))
      .take(MAX_MEMBERS);
    return { totals: totalsOf(rows), truncated: rows.length === MAX_MEMBERS };
  }
  const { rows, truncated } = await workspaceDays(ctx, workspace._id, range.current, dayCap);
  return { totals: totalsByMember(rows), truncated };
}

export function totalsOf(rows: Doc<"memberStats">[]) {
  return new Map<Id<"members">, Totals>(
    rows.map((r) => [r.memberId, { given: r.given, received: r.received, maxedDays: r.maxedDays, activeDays: r.activeDays }]),
  );
}

/** First discoveries counted in a `workspaceStats` bucket: all of them, and the legendary ones. */
export function discoveriesIn(stats: Doc<"workspaceStats"> | null) {
  return {
    discoveries: stats ? RARITIES.reduce((s, r) => s + stats.found[r], 0) : 0,
    legendaryFinds: stats?.found.legendary ?? 0,
  };
}

/** Kudos given in [from, to), newest first. */
export async function kudosInRange(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  from: number,
  to: number,
  cap = 3000,
): Promise<Bounded<Doc<"kudos">>> {
  const rows = await ctx.db
    .query("kudos")
    .withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspaceId).gte("at", from).lt("at", to))
    .order("desc")
    .take(cap);
  return { rows, truncated: rows.length === cap };
}

/** Dense ranking by value desc: ties share a rank. */
export function rankBy<T>(items: T[], value: (t: T) => number, name: (t: T) => string) {
  const sorted = [...items].sort((a, b) => value(b) - value(a) || name(a).localeCompare(name(b)));
  let rank = 0;
  let last: number | null = null;
  return sorted.map((item, i) => {
    const v = value(item);
    if (v !== last) {
      rank = i + 1;
      last = v;
    }
    return { item, rank };
  });
}

export function median(values: number[]) {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
