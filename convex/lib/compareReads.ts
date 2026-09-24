import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { reachFromKudos } from "./compare";
import { weekKeyOfDay } from "./quests";
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

/** Quest completions read per member: at most 3 a week, so a year and its previous year are ~320. */
const MAX_QUEST_COMPLETIONS = 1_000;

/**
 * `memberId`'s quest completions in every quest week that overlaps `range`. Only ever call this for
 * the viewer: quest data is the member's own (Quest spec D10).
 */
export async function questCompletions(ctx: QueryCtx, memberId: Id<"members">, range: DayRange) {
  return await ctx.db
    .query("questCompletions")
    .withIndex("by_member_week", (q) =>
      q.eq("memberId", memberId).gte("weekKey", weekKeyOfDay(range.start)).lte("weekKey", weekKeyOfDay(range.end)),
    )
    .take(MAX_QUEST_COMPLETIONS);
}

/**
 * How many of `completions` happened on a day of `range` in the workspace timezone. A quest week
 * that straddles the edge of a month, quarter or year splits by the day each quest was completed,
 * as every other Compare metric counts by day.
 */
export function completionsIn(completions: Doc<"questCompletions">[], range: DayRange, timeZone: string) {
  const from = startOfDayUtc(range.start, timeZone);
  const to = startOfDayUtc(addDays(range.end, 1), timeZone);
  return completions.filter((c) => c.completedAt >= from && c.completedAt < to).length;
}

/** The week the workspace's quests began: its first stored board (null while it has none). */
export async function firstQuestWeek(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const first = await ctx.db
    .query("questBoards")
    .withIndex("by_workspace_week", (q) => q.eq("workspaceId", workspaceId))
    .first();
  return first?.weekKey ?? null;
}
