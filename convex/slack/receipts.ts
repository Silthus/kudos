import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { processEvent } from "./processEvent";

const keptForMs = 7 * 24 * 60 * 60 * 1000;
const deletionBatchSize = 500;

export const receive = internalMutation({
  args: { workspace: v.string(), eventId: v.string() },
  handler: async (ctx, receipt) => {
    const redelivered = await ctx.db
      .query("slackReceipts")
      .withIndex("by_event", (q) => q.eq("workspace", receipt.workspace).eq("eventId", receipt.eventId))
      .unique();
    if (redelivered !== null) return;
    await ctx.db.insert("slackReceipts", receipt);
    await processEvent(ctx, receipt);
  },
});

export const deleteExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("slackReceipts")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", Date.now() - keptForMs))
      .take(deletionBatchSize);
    await Promise.all(expired.map((receipt) => ctx.db.delete(receipt._id)));
    if (expired.length === deletionBatchSize) await ctx.scheduler.runAfter(0, internal.slack.receipts.deleteExpired, {});
  },
});
