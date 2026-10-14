import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalMutation, type MutationCtx } from "../_generated/server";
import { captureSettings, type Capture } from "./capture";
import { postHogExceptionList } from "./exceptions";
import { failuresLogged } from "./failures";
import { followPeopleSentLate, forgetRecordedProfiles, markDeliveriesUncertain, personEventsIn, withoutStalePersonEvents } from "./person";

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
const sentPersonEventValidator = v.object({ row: v.id("analyticsOutbox"), distinctId: v.string() });
type Answer = typeof answerValidator.type;

export const drain = internalAction({
  args: { generation: v.string() },
  handler: (ctx, { generation }) =>
    failuresLogged("analytics.drain_failed", async () => {
      for (;;) {
        const capture = captureSettings();
        const claimed: Claim | null = await ctx.runMutation(internal.analytics.drain.claim, { generation });
        if (claimed === null || capture === null) return;
        const answer = await send(capture, claimed.rows);
        await ctx.runMutation(internal.analytics.drain.settle, { token: claimed.token, rows: claimed.rows.map((row) => row._id), people: personEventsIn(claimed.rows), answer });
      }
    }),
});

export const claim = internalMutation({
  args: { generation: v.string() },
  handler: async (ctx, { generation }): Promise<Claim | null> => {
    const current = await ctx.db.query("analyticsDrain").first();
    if (current?.generation !== generation) return null;
    const due = captureSettings() === null ? [] : await withoutStalePersonEvents(ctx, await dueRows(ctx));
    if (due.length === 0) {
      await ctx.db.delete(current._id);
      await wakeDrain(ctx);
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
  args: { token: v.string(), rows: v.array(v.id("analyticsOutbox")), people: v.array(sentPersonEventValidator), answer: answerValidator },
  handler: async (ctx, { token, rows, people, answer }) => {
    const now = Date.now();
    const leased = (await Promise.all(rows.map((id) => ctx.db.get(id)))).filter((row): row is OutboxRow => row?.lease === token && row.dueAt > now);
    await followPeopleSentLate(ctx, people, leased);
    if (answer === "failed") await markDeliveriesUncertain(ctx, people);
    const held = answer === "delivered" ? leased : await withoutStalePersonEvents(ctx, leased);
    if (answer === "delivered") {
      for (const row of held) await ctx.db.delete(row._id);
    } else if (captureSettings() === null) {
      await release(ctx, held);
    } else if (answer === "rejected") {
      await giveUp(ctx, held, "rejected");
    } else {
      await retryOrGiveUp(ctx, held);
    }
  },
});

export const recover = internalMutation({
  args: {},
  handler: (ctx) =>
    failuresLogged("analytics.recovery_failed", async () => {
      const expiredLeases = await ctx.db
        .query("analyticsOutbox")
        .withIndex("by_due", (q) => q.eq("state", "sending").lte("dueAt", Date.now()))
        .take(cleanUpBatchSize);
      await markDeliveriesUncertain(ctx, personEventsIn(expiredLeases));
      await release(ctx, expiredLeases);
      if (expiredLeases.length > 0) await replaceDrain(ctx);
      else await wakeDrain(ctx);
    }),
});

export const cleanUp = internalMutation({
  args: {},
  handler: (ctx) => failuresLogged("analytics.cleanup_failed", () => cleanUpOutbox(ctx)),
});

async function cleanUpOutbox(ctx: MutationCtx) {
  const now = Date.now();
  const expired = await ctx.db
    .query("analyticsOutbox")
    .withIndex("by_state", (q) => q.eq("state", "pending").lte("_creationTime", now - pendingKeptForMs))
    .take(cleanUpBatchSize);
  await giveUp(ctx, await withoutStalePersonEvents(ctx, expired), "expired");
  const forgotten = await ctx.db
    .query("analyticsOutbox")
    .withIndex("by_due", (q) => q.eq("state", "exhausted").lte("dueAt", now))
    .take(cleanUpBatchSize);
  for (const row of forgotten) await ctx.db.delete(row._id);
  if (expired.length === cleanUpBatchSize || forgotten.length === cleanUpBatchSize) {
    await ctx.scheduler.runAfter(0, internal.analytics.drain.cleanUp, {});
  }
}

export function wakeDrain(ctx: MutationCtx) {
  return scheduleDrain(ctx, { replacingARunningDrain: false });
}

function replaceDrain(ctx: MutationCtx) {
  return scheduleDrain(ctx, { replacingARunningDrain: true });
}

async function scheduleDrain(ctx: MutationCtx, { replacingARunningDrain }: { replacingARunningDrain: boolean }) {
  if (captureSettings() === null) return;
  const next = await ctx.db
    .query("analyticsOutbox")
    .withIndex("by_due", (q) => q.eq("state", "pending"))
    .first();
  if (next === null) return;
  const at = Math.max(next.dueAt, Date.now());
  const current = await ctx.db.query("analyticsDrain").first();
  const job = current === null ? null : await ctx.db.system.get(current.job);
  if (job?.state.kind === "inProgress" && !replacingARunningDrain) return;
  if (job?.state.kind === "pending") {
    if (job.scheduledTime <= at) return;
    await ctx.scheduler.cancel(job._id);
  }
  const generation = crypto.randomUUID();
  const scheduled = await ctx.scheduler.runAt(at, internal.analytics.drain.drain, { generation });
  if (current === null) await ctx.db.insert("analyticsDrain", { job: scheduled, generation });
  else await ctx.db.patch(current._id, { job: scheduled, generation });
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

async function release(ctx: MutationCtx, rows: OutboxRow[]) {
  for (const row of rows) await ctx.db.patch(row._id, { state: "pending", lease: undefined, dueAt: Date.now() });
}

async function giveUp(ctx: MutationCtx, rows: OutboxRow[], reason: GiveUpReason) {
  if (rows.length === 0) return;
  for (const row of rows) {
    await ctx.db.patch(row._id, { state: "exhausted", reason, lease: undefined, dueAt: Date.now() + givenUpKeptForMs });
  }
  await forgetRecordedProfiles(ctx, rows);
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
      properties: {
        ...withPostHogNames(row.properties),
        ...(row.exception && { $exception_list: postHogExceptionList(row.exception) }),
        ...(row.person && { $set: row.person.set }),
        ...(row.person && row.person.unset.length > 0 && { $unset: row.person.unset }),
      },
    })),
  };
}

const postHogNames: Record<string, string> = { feature_flag: "$feature_flag", feature_flag_response: "$feature_flag_response" };

function withPostHogNames(properties: OutboxRow["properties"]) {
  return Object.fromEntries(Object.entries(properties).map(([name, value]) => [postHogNames[name] ?? name, value]));
}
