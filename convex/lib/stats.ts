import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
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

export async function workspaceMembers(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const rows = await ctx.db
    .query("members")
    .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspaceId))
    .take(5000);
  return rows.filter((m) => !m.isBot);
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
