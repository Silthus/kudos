import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { awardsInWorkspace, type WorkspaceAward } from "../engine/awards";
import { hugsInWorkspace, hugWithId, type Hug } from "../hugs/records";
import type { MemberId } from "../workspace/directory";
import { recordHistorySticker } from "./stickers";
import { countOnTheBoardsOnce } from "./boards";
import { storedKudosWeightOf, talliedAwardOf, tallyAward, tallyHugPeople, type KudosWeight } from "./tallies";
import type { Doc } from "../_generated/dataModel";

export const awardsPerHistoryPage = 50;
export const awardsPerBoardsFillPage = 50;
export const hugPeoplePerHistoryPage = 50;

type AlbumHistory = Doc<"albumHistory">;

export const startAlbumHistory = internalMutation({
  args: { workspace: v.string() },
  returns: v.null(),
  handler: async (ctx, { workspace }) => {
    if ((await historyOf(ctx, workspace)) !== null) return null;
    await ctx.db.insert("albumHistory", { workspace, startedAt: Date.now(), phase: "kudos", cursor: null, done: false });
    await ctx.scheduler.runAfter(0, internal.album.history.recordAlbumHistory, { workspace });
    return null;
  },
});

export const recordAlbumHistory = internalMutation({
  args: { workspace: v.string() },
  returns: v.null(),
  handler: async (ctx, { workspace }) => {
    const history = await historyOf(ctx, workspace);
    if (history === null || history.done) return null;
    const moved = history.phase === "kudos" ? await recordAwardsPage(ctx, history) : await tallyHugsPage(ctx, history);
    await ctx.db.patch(history._id, moved);
    if (moved.done) await ctx.scheduler.runAfter(0, internal.album.milestones.recordMilestonesInWorkspace, { workspace, cursor: null });
    else await ctx.scheduler.runAfter(0, internal.album.history.recordAlbumHistory, { workspace });
    return null;
  },
});

export const fillThoughtfulBoards = internalMutation({
  args: { workspace: v.string(), cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { workspace, cursor }) => {
    const { page, continueCursor, isDone } = await awardsInWorkspace(ctx, workspace, { cursor: cursor ?? null, numItems: awardsPerBoardsFillPage });
    const weightOf = wordsOfEachMessage(ctx);
    for (const award of page) if (await isThoughtfulAndTallied(ctx, award, weightOf)) await countOnTheBoardsOnce(ctx, { award: award.award, workspace, giver: award.giver, day: award.day });
    if (!isDone) await ctx.scheduler.runAfter(0, internal.album.history.fillThoughtfulBoards, { workspace, cursor: continueCursor });
    return null;
  },
});

export const albumHistoryOf = internalQuery({
  args: { workspace: v.string() },
  returns: v.union(v.object({ startedAt: v.number(), done: v.boolean() }), v.null()),
  handler: async (ctx, { workspace }) => {
    const history = await historyOf(ctx, workspace);
    return history === null ? null : { startedAt: history.startedAt, done: history.done };
  },
});

type Moved = Pick<AlbumHistory, "phase" | "cursor" | "hug" | "hugPeopleAfter" | "done">;

async function recordAwardsPage(ctx: MutationCtx, history: AlbumHistory): Promise<Moved> {
  const { page, continueCursor, isDone } = await awardsInWorkspace(ctx, history.workspace, { cursor: history.cursor, numItems: awardsPerHistoryPage });
  const wordsOf = wordsOfEachMessage(ctx);
  for (const award of page) {
    if (award.created < history._creationTime) await recordHistorySticker(ctx, award.giver, award.recipient, award.at);
    await tallyAward(ctx, award, await wordsOf(award));
  }
  return isDone ? { phase: "hugs", cursor: null, done: false } : { phase: "kudos", cursor: continueCursor, done: false };
}

async function isThoughtfulAndTallied(ctx: QueryCtx, award: WorkspaceAward, weightOf: (award: WorkspaceAward) => Promise<KudosWeight>) {
  return (await talliedAwardOf(ctx, award.award)) !== null && (await weightOf(award)).thoughtful;
}

async function tallyHugsPage(ctx: MutationCtx, history: AlbumHistory): Promise<Moved> {
  const unfinished = history.hug === undefined ? null : await hugWithId(ctx, history.hug);
  if (unfinished !== null) return { ...(await tallyHugOnTheHistoryPage(ctx, unfinished, history.hugPeopleAfter ?? null)), cursor: history.cursor };
  const { page, continueCursor, isDone } = await hugsInWorkspace(ctx, history.workspace, { cursor: history.cursor, numItems: 1 });
  const [hug] = page;
  if (hug === undefined) return { phase: "hugs", cursor: continueCursor, done: isDone };
  const tallied = await tallyHugOnTheHistoryPage(ctx, hug, null);
  return { ...tallied, cursor: continueCursor, done: isDone && tallied.hug === undefined };
}

async function tallyHugOnTheHistoryPage(ctx: MutationCtx, hug: Hug, after: MemberId | null): Promise<Omit<Moved, "cursor">> {
  const { last } = await tallyHugPeople(ctx, hug, after, hugPeoplePerHistoryPage);
  return last === null ? { phase: "hugs", hug: undefined, hugPeopleAfter: undefined, done: false } : { phase: "hugs", hug: hug._id, hugPeopleAfter: last, done: false };
}

function wordsOfEachMessage(ctx: QueryCtx) {
  const known = new Map<string, KudosWeight>();
  return async ({ message }: WorkspaceAward) => {
    const key = `${message.conversation}/${message.message}`;
    if (!known.has(key)) known.set(key, await storedKudosWeightOf(ctx, message));
    return known.get(key)!;
  };
}

function historyOf(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("albumHistory")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}
