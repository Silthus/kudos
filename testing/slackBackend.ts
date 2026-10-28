import staticHostingComponent from "@convex-dev/static-hosting/test";
import postHogComponent from "@posthog/convex/test";
import { convexTest } from "convex-test";
import type { GenericDatabaseReader } from "convex/server";
import { vi } from "vitest";
import type { DataModel } from "../convex/_generated/dataModel";
import schema from "../convex/schema";
import { modules } from "../convex/test.setup";
import { signedRequest } from "./signedSlack";
import { memberEvent, messageChangedEvent, messageDeletedEvent, messageEvent, reactionEvent, threadParentDeletedEvent, type DeletionOptions, type EditOptions, type MessageOptions, type ReactionOptions, type RichElement } from "./slackMessages";

export type Backend = ReturnType<typeof testBackend>;

const realSetTimeout = globalThis.setTimeout;
const idleAfterMs = 200;

export function testBackend({ transactionLimits = false }: { transactionLimits?: boolean } = {}) {
  const t = convexTest({ schema, modules, transactionLimits });
  postHogComponent.register(t);
  staticHostingComponent.register(t);
  return t;
}

export async function post(t: Backend, blocks: RichElement[], options: MessageOptions = {}) {
  return t.fetch("/slack/events", await signedRequest(messageEvent(blocks, options)));
}

export async function edit(t: Backend, blocks: RichElement[], options: EditOptions = {}) {
  return t.fetch("/slack/events", await signedRequest(messageChangedEvent(blocks, options)));
}

export async function deleteMessage(t: Backend, options: DeletionOptions = {}) {
  return t.fetch("/slack/events", await signedRequest(messageDeletedEvent(options)));
}

export async function deleteThreadParent(t: Backend, options: DeletionOptions = {}) {
  return t.fetch("/slack/events", await signedRequest(threadParentDeletedEvent(options)));
}

export async function react(t: Backend, options: ReactionOptions = {}) {
  return t.fetch("/slack/events", await signedRequest(reactionEvent(options)));
}

export async function memberChanged(t: Backend, ...event: Parameters<typeof memberEvent>) {
  return t.fetch("/slack/events", await signedRequest(memberEvent(...event)));
}

export async function settle(t: Backend) {
  await settleInTimeOrder(t, { maxTimers: 10_000 });
}

export async function settleInTimeOrder(t: Backend, { until = Infinity, maxTimers = 200, whileFunctionsRun = false } = {}) {
  for (let fired = 0; fired < maxTimers; fired += 1) {
    await (whileFunctionsRun ? finishedOrIdle(t) : t.finishInProgressScheduledFunctions());
    if (vi.getTimerCount() === 0 || Date.now() >= until) return;
    vi.advanceTimersToNextTimer();
  }
  throw new Error(`settleInTimeOrder: more than ${maxTimers} timers fired`);
}

function finishedOrIdle(t: Backend) {
  return Promise.race([t.finishInProgressScheduledFunctions(), new Promise((resolve) => realSetTimeout(resolve, idleAfterMs))]);
}

export async function settleUntil(t: Backend, until: Date) {
  const timeStepMs = 1000;
  while (Date.now() < until.getTime()) {
    vi.advanceTimersByTime(Math.min(timeStepMs, until.getTime() - Date.now()));
    await t.finishInProgressScheduledFunctions();
  }
}

export async function settleUpTo(t: Backend, until: number) {
  for (let fired = 0; fired < 1_000; fired += 1) {
    await t.finishInProgressScheduledFunctions();
    const next = await nextJobAt(t);
    if (next === null || next > until) {
      vi.advanceTimersByTime(Math.max(0, until - Date.now()));
      return;
    }
    vi.advanceTimersToNextTimer();
  }
  throw new Error("settleUpTo: more than 1,000 timers fired");
}

async function nextJobAt(t: Backend) {
  const pending = await t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).filter(({ state }) => state.kind === "pending"));
  return pending.length === 0 ? null : Math.min(...pending.map(({ scheduledTime }) => scheduledTime));
}

export async function convexStops(t: Backend, functionName: string) {
  await t.run(async (ctx) => {
    for (const job of await pendingJobsOf(ctx, functionName)) await ctx.scheduler.cancel(job._id);
  });
}

export function pendingJobs(t: Backend, functionName: string) {
  return t.run(async (ctx) => (await pendingJobsOf(ctx, functionName)).length);
}

async function pendingJobsOf(ctx: { db: GenericDatabaseReader<DataModel> }, functionName: string) {
  return (await ctx.db.system.query("_scheduled_functions").collect()).filter((job) => job.name === functionName && job.state.kind === "pending");
}

export async function setWorkspaceSettings(t: Backend, settings: { kudosEmoji?: string; announcementChannel?: string }, workspace = "T1") {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("workspaces")
      .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
      .unique();
    if (row === null) await ctx.db.insert("workspaces", { workspace, ...settings });
    else await ctx.db.patch(row._id, settings);
  });
}

export async function kudosReceived(t: Backend, user: string) {
  const awards = await awardsTo(t, user);
  return awards.reduce((sum, award) => sum + award.kudos, 0);
}

export async function awardsTo(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    if (member === null) return [];
    return ctx.db
      .query("awards")
      .withIndex("by_recipient", (q) => q.eq("recipient", member._id))
      .collect();
  });
}

export async function kudosSpent(t: Backend) {
  return t.run(async (ctx) => {
    const spending = await ctx.db.query("allowanceSpending").collect();
    return spending.reduce((sum, row) => sum + row.spent, 0);
  });
}

type Table = keyof typeof schema.tables;

export async function everythingStored(t: Backend, { except = [] }: { except?: Table[] } = {}) {
  const tables = (Object.keys(schema.tables) as Table[]).filter((table) => !except.includes(table));
  return t.run(async (ctx) => {
    const rows = await Promise.all(tables.map((table) => ctx.db.query(table).collect()));
    return rows.flat();
  });
}
