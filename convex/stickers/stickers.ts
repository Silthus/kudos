import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { kudosGivenEventValidator } from "../bus/events";
import { startBackfillUnlessStarted } from "./backfill";
import { checkAlbumsAfter, type NewSticker } from "./completions";
import { recordStickersOf } from "./records";

export const awardsPerMutation = 50;

export const recordStickers = internalMutation({
  args: { event: kudosGivenEventValidator, from: v.optional(v.number()) },
  handler: async (ctx, { event, from = 0 }) => {
    if (from === 0) await startBackfillUnlessStarted(ctx, event.workspace);
    const next = from + awardsPerMutation;
    const newStickers: NewSticker[] = [];
    for (const award of event.awards.slice(from, next)) for (const member of await recordStickersOf(ctx, award)) newStickers.push({ member, award: award.award });
    await checkAlbumsAfter(ctx, event, newStickers);
    if (next < event.awards.length) await ctx.scheduler.runAfter(0, internal.stickers.stickers.recordStickers, { event, from: next });
  },
});
