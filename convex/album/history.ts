import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { awardsInWorkspace, type WorkspaceAward } from "../engine/awards";
import { hugsInWorkspace } from "../hugs/records";
import { recordHistorySticker } from "./stickers";
import { storedKudosWordsOf, tallyAward, type KudosWords } from "./tallies";
import type { Doc } from "../_generated/dataModel";

export const awardsPerHistoryPage = 50;
export const hugsPerHistoryPage = 50;

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
    if (!moved.done) await ctx.scheduler.runAfter(0, internal.album.history.recordAlbumHistory, { workspace });
    return null;
  },
});

type Moved = Pick<AlbumHistory, "phase" | "cursor" | "done">;

async function recordAwardsPage(ctx: MutationCtx, history: AlbumHistory): Promise<Moved> {
  const { page, continueCursor, isDone } = await awardsInWorkspace(ctx, history.workspace, { cursor: history.cursor, numItems: awardsPerHistoryPage });
  const wordsOf = wordsOfEachMessage(ctx);
  for (const award of page) {
    if (award.created < history.startedAt) await recordHistorySticker(ctx, award.giver, award.recipient, award.at);
    await tallyAward(ctx, award, await wordsOf(award));
  }
  return isDone ? { phase: "hugs", cursor: null, done: false } : { phase: "kudos", cursor: continueCursor, done: false };
}

async function tallyHugsPage(ctx: MutationCtx, history: AlbumHistory): Promise<Moved> {
  const { page, continueCursor, isDone } = await hugsInWorkspace(ctx, history.workspace, { cursor: history.cursor, numItems: hugsPerHistoryPage });
  for (const hug of page) await ctx.scheduler.runAfter(0, internal.album.tallies.tallyHug, { hug: hug._id, cursor: null });
  return { phase: "hugs", cursor: continueCursor, done: isDone };
}

function wordsOfEachMessage(ctx: QueryCtx) {
  const known = new Map<string, KudosWords>();
  return async ({ message }: WorkspaceAward) => {
    const key = `${message.conversation}/${message.message}`;
    if (!known.has(key)) known.set(key, await storedKudosWordsOf(ctx, message));
    return known.get(key)!;
  };
}

function historyOf(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("albumHistory")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}
