import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { kudosGivenEventValidator } from "../bus/events";
import { publish } from "../bus/publish";
import { startBackfillUnlessStarted } from "./backfill";
import { checkTeamPagesAfter, type NewSticker } from "./completions";
import { recordStickersOf, type CollectedSticker } from "./records";

export const awardsPerMutation = 50;

export const recordStickers = internalMutation({
  args: { event: kudosGivenEventValidator, from: v.optional(v.number()) },
  handler: async (ctx, { event, from = 0 }) => {
    if (from === 0) await startBackfillUnlessStarted(ctx, event.workspace);
    const next = from + awardsPerMutation;
    const newStickers: NewSticker[] = [];
    const collected: CollectedSticker[] = [];
    for (const award of event.awards.slice(from, next)) {
      const stickers = await recordStickersOf(ctx, award);
      collected.push(...stickers);
      for (const { collector } of stickers) newStickers.push({ member: collector, award: award.award });
    }
    if (collected.length > 0) await publish(ctx, { type: "stickersCollected", workspace: event.workspace, stickers: collected, at: event.at });
    await checkTeamPagesAfter(ctx, event, newStickers);
    if (next < event.awards.length) await ctx.scheduler.runAfter(0, internal.stickers.stickers.recordStickers, { event, from: next });
  },
});
