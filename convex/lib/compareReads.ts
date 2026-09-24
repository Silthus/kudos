import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { reachFromKudos } from "./compare";
import { addDays, startOfDayUtc, type DayRange } from "./time";

/**
 * Per-member reads shared by the Past you and Teammate benchmarks. Each one is bounded by one
 * member's own history, so neither query's cost grows with the workspace.
 */

/** Given kudos rows read per range for reach and channels: the daily limit keeps real ranges far below this. */
export const MAX_KUDOS_PER_RANGE = 2_000;

/** Discoveries read per member: the catalog has far fewer templates than this. */
const MAX_DISCOVERIES = 500;

/** Reach and channels of the kudos `memberId` gave in `range`; `truncated` when the read hit its cap. */
export async function givenKudos(ctx: QueryCtx, memberId: Id<"members">, range: DayRange, timeZone: string) {
  const rows = await ctx.db
    .query("kudos")
    .withIndex("by_giver_at", (q) =>
      q
        .eq("giverId", memberId)
        .gte("at", startOfDayUtc(range.start, timeZone))
        .lt("at", startOfDayUtc(addDays(range.end, 1), timeZone)),
    )
    .order("desc")
    .take(MAX_KUDOS_PER_RANGE);
  return { ...reachFromKudos(rows), truncated: rows.length === MAX_KUDOS_PER_RANGE };
}

/** Every template `memberId` has discovered. */
export async function memberDiscoveries(ctx: QueryCtx, memberId: Id<"members">) {
  return await ctx.db
    .query("discoveries")
    .withIndex("by_member_template", (q) => q.eq("memberId", memberId))
    .take(MAX_DISCOVERIES);
}

/** How many of `discoveries` were first seen inside `range`. */
export function newDiscoveriesIn(discoveries: Doc<"discoveries">[], range: DayRange, timeZone: string) {
  const from = startOfDayUtc(range.start, timeZone);
  const to = startOfDayUtc(addDays(range.end, 1), timeZone);
  return discoveries.filter((d) => d.firstSeenAt >= from && d.firstSeenAt < to).length;
}
