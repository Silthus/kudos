import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { awardsInWorkspace } from "../engine/awards";
import { awardReaching, countAward, countingOf } from "./counting";
import { achievementsApplyIn } from "./flag";
import { ladderOf, ladders, ladderValidator, tierValidator, type LadderId, type TierId } from "./ladders";
import { earnTier } from "./tiers";

export const bookReplayValidator = v.object({
  workspace: v.string(),
  batch: v.id("bookBatches"),
  ladder: ladderValidator,
  tiers: v.array(tierValidator),
  countsLadder: v.boolean(),
  cursor: v.union(v.string(), v.null()),
  isDone: v.boolean(),
});

export type BatchId = Id<"bookBatches">;

type BookReplay = Doc<"bookReplays">;

type Unevaluated = Pick<Infer<typeof bookReplayValidator>, "ladder" | "tiers" | "countsLadder">;

type ReplayedPage = { isDone: boolean; continueCursor: string };

type Earned = { batch: BatchId; hidden?: true };

const awardsPerPage = 100;

const membersPerPage = 100;

export async function replayWhatIsNew(ctx: MutationCtx, workspace: string): Promise<void> {
  const unevaluated = unevaluatedIn(await replaysIn(ctx, workspace));
  if (unevaluated.length === 0) return;
  const batch = await ctx.db.insert("bookBatches", { workspace, at: Date.now() });
  for (const replay of unevaluated) {
    const started = await ctx.db.insert("bookReplays", { workspace, batch, ...replay, cursor: null, isDone: false });
    await ctx.scheduler.runAfter(0, internal.achievements.replay.replayPage, { replay: started });
  }
}

export async function laddersCountedLiveIn(ctx: QueryCtx, workspace: string): Promise<LadderId[]> {
  const replays = await replaysIn(ctx, workspace);
  return ladders.ladders.map(({ ladder }) => ladder).filter((ladder) => replays.some((replay) => replay.ladder === ladder && replay.countsLadder && replay.isDone));
}

export const replayPage = internalMutation({
  args: { replay: v.id("bookReplays") },
  handler: async (ctx, { replay: id }): Promise<void> => {
    const replay = await ctx.db.get(id);
    if (replay === null || replay.isDone || !(await canRunNow(ctx, replay))) return;
    const earned = await earnedIn(ctx, replay);
    const { isDone, continueCursor } = replay.countsLadder ? await countHistory(ctx, replay, earned) : await evaluateTiers(ctx, replay, earned);
    await ctx.db.patch(id, { cursor: continueCursor, isDone });
    if (isDone) await finish(ctx, replay);
    else await ctx.scheduler.runAfter(0, internal.achievements.replay.replayPage, { replay: id });
  },
});

function unevaluatedIn(replays: BookReplay[]): Unevaluated[] {
  return ladders.ladders.flatMap(({ ladder, tiers }) => {
    const ofLadder = replays.filter((replay) => replay.ladder === ladder);
    const evaluated = new Set(ofLadder.flatMap((replay) => replay.tiers));
    const added = tiers.map(({ tier }) => tier).filter((tier) => !evaluated.has(tier));
    if (added.length === 0) return [];
    return [{ ladder, tiers: added, countsLadder: !ofLadder.some(({ countsLadder }) => countsLadder) }];
  });
}

async function earnedIn(ctx: QueryCtx, { workspace, batch }: BookReplay): Promise<Earned> {
  return { batch, ...(!(await achievementsApplyIn(ctx, workspace)) && { hidden: true }) };
}

async function countHistory(ctx: MutationCtx, { workspace, ladder, tiers, cursor }: BookReplay, earned: Earned): Promise<ReplayedPage> {
  const awards = await awardsInWorkspace(ctx, workspace, { cursor, numItems: awardsPerPage });
  for (const award of awards.page) await countAward(ctx, workspace, countingOf(ladder, award), award, { tiers: tiersOf(ladder, tiers), ...earned });
  return awards;
}

async function evaluateTiers(ctx: MutationCtx, { workspace, ladder, tiers, cursor }: BookReplay, earned: Earned): Promise<ReplayedPage> {
  const members = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", workspace))
    .paginate({ cursor, numItems: membersPerPage });
  for (const { _id: member } of members.page) {
    for (const tier of tiersOf(ladder, tiers)) {
      const reaching = await awardReaching(ctx, { member, ladder }, tier.count);
      if (reaching !== null) await earnTier(ctx, { workspace, member, ladder, award: reaching.award, at: reaching.at, ...earned }, tier);
    }
  }
  return members;
}

function tiersOf(ladder: LadderId, tiers: TierId[]) {
  return ladderOf(ladder).tiers.filter(({ tier }) => tiers.includes(tier));
}

async function finish(ctx: MutationCtx, replay: BookReplay) {
  await completeIfLast(ctx, replay.batch);
  if (!replay.countsLadder) return;
  for (const { _id, countsLadder, isDone } of await replaysOf(ctx, replay)) {
    if (!countsLadder && !isDone) await ctx.scheduler.runAfter(0, internal.achievements.replay.replayPage, { replay: _id });
  }
}

async function canRunNow(ctx: QueryCtx, replay: BookReplay) {
  return replay.countsLadder || (await replaysOf(ctx, replay)).some(({ countsLadder, isDone }) => countsLadder && isDone);
}

function replaysOf(ctx: QueryCtx, { workspace, ladder }: BookReplay) {
  return ctx.db
    .query("bookReplays")
    .withIndex("by_workspace_ladder", (q) => q.eq("workspace", workspace).eq("ladder", ladder))
    .collect();
}

async function completeIfLast(ctx: MutationCtx, batch: BatchId) {
  const replays = await ctx.db
    .query("bookReplays")
    .withIndex("by_batch", (q) => q.eq("batch", batch))
    .collect();
  if (!replays.every(({ isDone }) => isDone)) return;
  await ctx.db.patch(batch, { completedAt: Date.now() });
  await ctx.scheduler.runAfter(0, internal.feedback.tierNotices.tellBatchSummaries, { batch, cursor: null });
}

function replaysIn(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("bookReplays")
    .withIndex("by_workspace_ladder", (q) => q.eq("workspace", workspace))
    .collect();
}
