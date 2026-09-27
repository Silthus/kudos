import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { monthBucket } from "./buckets";
import { GAME_COUNTERS, gameFields, offeringTally, SUCCESS_COUNTERS, zeroGame, type GameCounts } from "./success";
import { addDays, dayKeyFor, startOfDayUtc } from "./time";

/**
 * The game's side of the success metrics (#165, design plan #152 S11; lib/success.ts GAME_COUNTERS),
 * on the month rows of `successStats`. Every write that changes what they count calls in here in its
 * own transaction (live maintenance, like the kudos rollups): an offering made, claimed, revoked or
 * replayed (`offeringChanged`), a claim at the stone (`claimed`), a member paid for a cleared run
 * (`expeditionCleared`), a member's first gift to a crew quest or its refund (`crewLineChanged`).
 * `gameCounts` recounts a month from small rows (claim and expedition events, offerings, crew lines):
 * the rollup rebuild writes it, and verify compares with it.
 */

type Workspace = Doc<"workspaces">;
type OfferingFacts = Pick<Doc<"offerings">, "coins" | "createdAt" | "claimedAt">;

/** Rows a recount reads of each source in a month; one that fills it throws rather than write a short count. */
const RECOUNT_READ = 8000;

const monthOf = (workspace: Workspace, at: number) => monthBucket(dayKeyFor(at, workspace.timezone));

/** Adds `delta` to the game counters of the month `at` falls in; a row with nothing left in it goes. */
async function bump(ctx: MutationCtx, workspace: Workspace, at: number, delta: Partial<GameCounts>) {
  if (GAME_COUNTERS.every((c) => !delta[c])) return;
  const bucket = monthOf(workspace, at);
  const row = await ctx.db
    .query("successStats")
    .withIndex("by_workspace_bucket", (q) => q.eq("workspaceId", workspace._id).eq("bucket", bucket))
    .unique();
  const counts = zeroGame();
  for (const c of GAME_COUNTERS) counts[c] = Math.max(0, (row?.[c] ?? 0) + (delta[c] ?? 0));
  const empty = GAME_COUNTERS.every((c) => counts[c] === 0) && SUCCESS_COUNTERS.every((c) => (row?.[c] ?? 0) === 0);
  if (row) {
    if (empty) await ctx.db.delete(row._id);
    else await ctx.db.patch(row._id, gameFields(counts));
  } else if (!empty) {
    await ctx.db.insert("successStats", { workspaceId: workspace._id, bucket, pairs: 0, storyRows: 0, reciprocalRows: 0, ...gameFields(counts) });
  }
}

/** An offering was made (`before` null), changed, claimed or deleted (`after` null). */
export async function offeringChanged(ctx: MutationCtx, workspace: Workspace, before: OfferingFacts | null, after: OfferingFacts | null) {
  const [was, is] = [offeringTally(before), offeringTally(after)];
  const at = (after ?? before)?.createdAt;
  if (at === undefined) return;
  await bump(ctx, workspace, at, { offeredCoins: is.offeredCoins - was.offeredCoins, claimedSoonCoins: is.claimedSoonCoins - was.claimedSoonCoins });
}

/** A player claimed at the stone at `at`. */
export async function claimed(ctx: MutationCtx, workspace: Workspace, at: number) {
  await bump(ctx, workspace, at, { claims: 1 });
}

/** A member was paid for a cleared run at `at` (its `expedition` event). */
export async function expeditionCleared(ctx: MutationCtx, workspace: Workspace, at: number) {
  await bump(ctx, workspace, at, { expeditions: 1 });
}

/** The crew lines (one per quest) a member first gave to in `at`'s month. */
async function crewLinesIn(ctx: QueryCtx, workspace: Workspace, memberId: Id<"members">, at: number) {
  const bucket = monthOf(workspace, at);
  const lines = await ctx.db
    .query("crewContributions")
    .withIndex("by_member", (q) => q.eq("memberId", memberId))
    .take(RECOUNT_READ);
  return lines.filter((l) => monthOf(workspace, l.at) === bucket).length;
}

/**
 * A member's crew line first given at `at` was added (+1) or taken away (-1), already written: they
 * count in the month while they have a line first given in it.
 */
export async function crewLineChanged(ctx: MutationCtx, workspace: Workspace, memberId: Id<"members">, at: number, change: 1 | -1) {
  const now = await crewLinesIn(ctx, workspace, memberId, at);
  const before = now - change;
  await bump(ctx, workspace, at, { crewJoins: Number(now > 0) - Number(before > 0) });
}

/** `take(RECOUNT_READ)` that refuses to go on with a page it may have cut short. */
function whole<T>(rows: T[], what: string): T[] {
  if (rows.length >= RECOUNT_READ) throw new ConvexError(`Too many ${what} in one month to recount the game's success metrics (${RECOUNT_READ}+).`);
  return rows;
}

/** A month's game counters, recounted from the claim and expedition events, the offerings and the crew lines (`start`/`end`: its first and last day). */
export async function gameCounts(ctx: QueryCtx, workspace: Workspace, start: string, end: string): Promise<GameCounts> {
  const from = startOfDayUtc(start, workspace.timezone);
  const until = startOfDayUtc(addDays(end, 1), workspace.timezone);
  const events = (kind: "claim" | "expedition") =>
    ctx.db
      .query("gameEvents")
      .withIndex("by_workspace_kind_at", (q) => q.eq("workspaceId", workspace._id).eq("kind", kind).gte("at", from).lt("at", until))
      .take(RECOUNT_READ);
  const counts = zeroGame();
  counts.claims = whole(await events("claim"), "claims").filter((e) => e.by === "player").length;
  counts.expeditions = whole(await events("expedition"), "expeditions").length;
  const offerings = await ctx.db
    .query("offerings")
    .withIndex("by_workspace_createdAt", (q) => q.eq("workspaceId", workspace._id).gte("createdAt", from).lt("createdAt", until))
    .take(RECOUNT_READ);
  for (const o of whole(offerings, "offerings")) {
    const t = offeringTally(o);
    counts.offeredCoins += t.offeredCoins;
    counts.claimedSoonCoins += t.claimedSoonCoins;
  }
  const lines = await ctx.db
    .query("crewContributions")
    .withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspace._id).gte("at", from).lt("at", until))
    .take(RECOUNT_READ);
  counts.crewJoins = new Set(whole(lines, "crew gifts").flatMap((l) => (l.memberId ? [l.memberId] : []))).size;
  return counts;
}
