import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type QueryCtx } from "../_generated/server";
import { messageEventValidator } from "../engine/messageEvent";
import { directoryEntryValidator, record } from "../workspace/directory";
import { reportHomeOpened } from "./appHome";
import { processEvent } from "./processEvent";

type Receipt = { workspace: string; eventId: string };

const keptForMs = 7 * 24 * 60 * 60 * 1000;
const deletionBatchSize = 500;

export const receive = internalMutation({
  args: { workspace: v.string(), eventId: v.string(), event: v.union(messageEventValidator, v.null()) },
  handler: async (ctx, { event, ...receipt }) => {
    if (await isRedelivered(ctx, receipt)) return;
    const observation = await processEvent(ctx, event);
    if (observation?.kind !== "ignored") await ctx.db.insert("slackReceipts", receipt);
  },
});

export const receiveHomeOpened = internalMutation({
  args: { workspace: v.string(), eventId: v.string(), user: v.string(), at: v.number() },
  handler: async (ctx, { user, at, ...receipt }) => {
    if (await isRedelivered(ctx, receipt)) return;
    await ctx.db.insert("slackReceipts", receipt);
    await reportHomeOpened(ctx, receipt.workspace, user, at);
    await ctx.scheduler.runAfter(0, internal.slack.appHome.publishHome, { workspace: receipt.workspace, user });
  },
});

export const receiveMemberChanged = internalMutation({
  args: { workspace: v.string(), eventId: v.string(), user: v.string(), entry: directoryEntryValidator, asOf: v.number() },
  handler: async (ctx, { eventId, ...directoryRecord }) => {
    const receipt = { workspace: directoryRecord.workspace, eventId };
    if (await isRedelivered(ctx, receipt)) return;
    await ctx.db.insert("slackReceipts", receipt);
    await record(ctx, directoryRecord);
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

async function isRedelivered(ctx: QueryCtx, receipt: Receipt) {
  const existing = await ctx.db
    .query("slackReceipts")
    .withIndex("by_event", (q) => q.eq("workspace", receipt.workspace).eq("eventId", receipt.eventId))
    .unique();
  return existing !== null;
}
