import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { awardsInWorkspace } from "../engine/awards";
import { recordStickersOf } from "./records";

export const awardsPerBackfillPage = 50;

export const startStickerBackfill = internalMutation({
  args: { workspace: v.string() },
  handler: (ctx, { workspace }) => startBackfillIn(ctx, workspace),
});

export const backfillStickers = internalMutation({
  args: { workspace: v.string() },
  handler: async (ctx, { workspace }) => {
    const backfill = await backfillOf(ctx, workspace);
    if (backfill === null || backfill.isDone) return;
    const { page, continueCursor, isDone } = await awardsInWorkspace(ctx, workspace, { cursor: backfill.cursor, numItems: awardsPerBackfillPage });
    for (const award of page) await recordStickersOf(ctx, award);
    await ctx.db.patch(backfill._id, { cursor: continueCursor, isDone });
    if (!isDone) await ctx.scheduler.runAfter(0, internal.stickers.backfill.backfillStickers, { workspace });
  },
});

export async function startBackfillUnlessStarted(ctx: MutationCtx, workspace: string) {
  if ((await backfillOf(ctx, workspace)) === null) await startBackfillIn(ctx, workspace);
}

async function startBackfillIn(ctx: MutationCtx, workspace: string) {
  const backfill = await backfillOf(ctx, workspace);
  if (backfill !== null && !backfill.isDone) return;
  const fromTheFirstAward = { cursor: null, isDone: false };
  if (backfill === null) await ctx.db.insert("stickerBackfills", { workspace, ...fromTheFirstAward });
  else await ctx.db.patch(backfill._id, fromTheFirstAward);
  await ctx.scheduler.runAfter(0, internal.stickers.backfill.backfillStickers, { workspace });
}

function backfillOf(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("stickerBackfills")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}
