import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalMutation, type MutationCtx } from "../_generated/server";
import { captureSettings, type Capture } from "./capture";

const batchSize = 100;
const answerTimeoutMs = 10_000;

type OutboxRow = Doc<"analyticsOutbox">;

export const drain = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    for (;;) {
      const batch: OutboxRow[] = await ctx.runMutation(internal.analytics.drain.claim, {});
      if (batch.length === 0) return;
      const delivered = await send(batch);
      await ctx.runMutation(internal.analytics.drain.settle, { rows: batch.map((row) => row._id), delivered });
      if (!delivered) return;
    }
  },
});

export const claim = internalMutation({
  args: {},
  handler: async (ctx): Promise<OutboxRow[]> => {
    const due =
      captureSettings() === null
        ? []
        : await ctx.db
            .query("analyticsOutbox")
            .withIndex("by_state", (q) => q.eq("state", "pending"))
            .take(batchSize);
    if (due.length === 0) await stopDrain(ctx);
    for (const row of due) await ctx.db.patch(row._id, { state: "sending" });
    return due;
  },
});

export const settle = internalMutation({
  args: { rows: v.array(v.id("analyticsOutbox")), delivered: v.boolean() },
  handler: async (ctx, { rows, delivered }) => {
    for (const id of rows) {
      if (delivered) await ctx.db.delete(id);
      else await ctx.db.patch(id, { state: "pending" });
    }
    if (!delivered) await stopDrain(ctx);
  },
});

async function stopDrain(ctx: MutationCtx) {
  const running = await ctx.db.query("analyticsDrain").first();
  if (running !== null) await ctx.db.delete(running._id);
}

async function send(batch: OutboxRow[]) {
  const capture = captureSettings();
  if (capture === null) return false;
  try {
    const response = await fetch(`${capture.host}/batch/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(batchBody(capture, batch)),
      signal: AbortSignal.timeout(answerTimeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function batchBody(capture: Capture, batch: OutboxRow[]) {
  return {
    api_key: capture.token,
    batch: batch.map((row) => ({
      event: row.event,
      distinct_id: row.distinctId,
      uuid: row.uuid,
      timestamp: new Date(row.timestamp).toISOString(),
      properties: row.properties,
    })),
  };
}
