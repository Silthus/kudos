import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalMutation, type MutationCtx } from "../_generated/server";
import { captureSettings, type Capture } from "./capture";

const batchSize = 100;
const answerTimeoutMs = 10_000;
const leaseMs = 2 * 60_000;
const retryDelaysMs = [1, 5, 30, 120, 360].map((minutes) => minutes * 60_000);
const rejectedStatuses = [400, 413];
const givenUpKeptForMs = 7 * 24 * 60 * 60_000;
const pendingKeptForMs = 7 * 24 * 60 * 60_000;
const cleanUpBatchSize = 500;

type OutboxRow = Doc<"analyticsOutbox">;
type GiveUpReason = NonNullable<OutboxRow["reason"]>;
type Claim = { token: string; rows: OutboxRow[] };

const answerValidator = v.union(v.literal("delivered"), v.literal("rejected"), v.literal("failed"));
type Answer = typeof answerValidator.type;

export const drain = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    try {
      for (;;) {
        const capture = captureSettings();
        const claimed: Claim | null = await ctx.runMutation(internal.analytics.drain.claim, {});
        if (claimed === null || capture === null) return;
        const answer = await send(capture, claimed.rows);
        await ctx.runMutation(internal.analytics.drain.settle, { token: claimed.token, rows: claimed.rows.map((row) => row._id), answer });
      }
    } catch (error) {
      console.error("analytics.drain_failed", { error: error instanceof Error ? error.name : typeof error });
    }
  },
});

export const claim = internalMutation({
  args: {},
  handler: async (ctx): Promise<Claim | null> => {
    const due = captureSettings() === null ? [] : await dueRows(ctx);
    if (due.length === 0) {
      await handOverToNextDrain(ctx);
      return null;
    }
    const token = crypto.randomUUID();
    const leasedUntil = Date.now() + leaseMs;
    for (const row of due) await ctx.db.patch(row._id, { state: "sending", lease: token, dueAt: leasedUntil });
    await ctx.scheduler.runAt(leasedUntil, internal.analytics.drain.recover, {});
    return { token, rows: due };
  },
});

export const settle = internalMutation({
  args: { token: v.string(), rows: v.array(v.id("analyticsOutbox")), answer: answerValidator },
  handler: async (ctx, { token, rows, answer }) => {
    const held = (await Promise.all(rows.map((id) => ctx.db.get(id)))).filter((row): row is OutboxRow => row?.lease === token);
    if (answer === "delivered") {
      for (const row of held) await ctx.db.delete(row._id);
    } else if (answer === "rejected") {
      await giveUp(ctx, held, "rejected");
    } else {
      await retryOrGiveUp(ctx, held);
    }
  },
});

export const recover = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredLeases = await ctx.db
      .query("analyticsOutbox")
      .withIndex("by_due", (q) => q.eq("state", "sending").lte("dueAt", now))
      .take(cleanUpBatchSize);
    for (const row of expiredLeases) await ctx.db.patch(row._id, { state: "pending", lease: undefined, dueAt: now });
    await wakeDrain(ctx);
  },
});

export const cleanUp = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("analyticsOutbox")
      .withIndex("by_state", (q) => q.eq("state", "pending").lte("_creationTime", now - pendingKeptForMs))
      .take(cleanUpBatchSize);
    await giveUp(ctx, expired, "expired");
    const forgotten = await ctx.db
      .query("analyticsOutbox")
      .withIndex("by_due", (q) => q.eq("state", "exhausted").lte("dueAt", now))
      .take(cleanUpBatchSize);
    for (const row of forgotten) await ctx.db.delete(row._id);
    if (expired.length === cleanUpBatchSize || forgotten.length === cleanUpBatchSize) {
      await ctx.scheduler.runAfter(0, internal.analytics.drain.cleanUp, {});
    }
  },
});

export async function wakeDrain(ctx: MutationCtx) {
  if (captureSettings() === null) return;
  const next = await ctx.db
    .query("analyticsOutbox")
    .withIndex("by_due", (q) => q.eq("state", "pending"))
    .first();
  if (next !== null) await ensureDrainBy(ctx, Math.max(next.dueAt, Date.now()));
}

async function ensureDrainBy(ctx: MutationCtx, at: number) {
  const singleton = await ctx.db.query("analyticsDrain").first();
  const job = singleton === null ? null : await ctx.db.system.get(singleton.job);
  if (job?.state.kind === "inProgress") return;
  if (job?.state.kind === "pending") {
    if (job.scheduledTime <= at) return;
    await ctx.scheduler.cancel(job._id);
  }
  const scheduled = await ctx.scheduler.runAt(at, internal.analytics.drain.drain, {});
  if (singleton === null) await ctx.db.insert("analyticsDrain", { job: scheduled });
  else await ctx.db.patch(singleton._id, { job: scheduled });
}

async function handOverToNextDrain(ctx: MutationCtx) {
  const running = await ctx.db.query("analyticsDrain").first();
  if (running !== null) await ctx.db.delete(running._id);
  await wakeDrain(ctx);
}

function dueRows(ctx: MutationCtx) {
  return ctx.db
    .query("analyticsOutbox")
    .withIndex("by_due", (q) => q.eq("state", "pending").lte("dueAt", Date.now()))
    .take(batchSize);
}

async function retryOrGiveUp(ctx: MutationCtx, rows: OutboxRow[]) {
  const exhausted = rows.filter((row) => row.failures === retryDelaysMs.length);
  for (const row of rows.filter((row) => row.failures < retryDelaysMs.length)) {
    await ctx.db.patch(row._id, { state: "pending", lease: undefined, failures: row.failures + 1, dueAt: Date.now() + retryDelaysMs[row.failures]! });
  }
  await giveUp(ctx, exhausted, "exhausted");
}

async function giveUp(ctx: MutationCtx, rows: OutboxRow[], reason: GiveUpReason) {
  if (rows.length === 0) return;
  for (const row of rows) {
    await ctx.db.patch(row._id, { state: "exhausted", reason, lease: undefined, dueAt: Date.now() + givenUpKeptForMs });
  }
  console.warn("analytics.events_given_up", { reason, events: rows.map((row) => row.event) });
}

async function send(capture: Capture, batch: OutboxRow[]): Promise<Answer> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), answerTimeoutMs);
  try {
    const response = await fetch(`${capture.host}/batch/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(batchBody(capture, batch)),
      signal: timeout.signal,
    });
    return answerTo(response.status);
  } catch {
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}

function answerTo(status: number): Answer {
  if (status >= 200 && status < 300) return "delivered";
  return rejectedStatuses.includes(status) ? "rejected" : "failed";
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
