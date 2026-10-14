import staticHostingComponent from "@convex-dev/static-hosting/test";
import postHogComponent from "@posthog/convex/test";
import { convexTest } from "convex-test";
import { vi } from "vitest";
import schema from "../convex/schema";
import { modules } from "../convex/test.setup";
import { signedRequest } from "./signedSlack";
import { memberEvent, messageChangedEvent, messageDeletedEvent, messageEvent, threadParentDeletedEvent, type DeletionOptions, type EditOptions, type MessageOptions, type RichElement } from "./slackMessages";

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

export async function memberChanged(t: Backend, ...event: Parameters<typeof memberEvent>) {
  return t.fetch("/slack/events", await signedRequest(memberEvent(...event)));
}

export async function settle(t: Backend) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

export async function settleInTimeOrder(t: Backend, { until = Infinity, maxTimers = 200 } = {}) {
  for (let fired = 0; fired < maxTimers; fired += 1) {
    await Promise.race([
      t.finishInProgressScheduledFunctions(),
      new Promise((resolve) => realSetTimeout(resolve, idleAfterMs)),
    ]);
    if (vi.getTimerCount() === 0 || Date.now() >= until) return;
    vi.advanceTimersToNextTimer();
  }
  throw new Error(`settleInTimeOrder: more than ${maxTimers} timers fired`);
}

export async function settleUntil(t: Backend, until: Date) {
  const timeStepMs = 1000;
  while (Date.now() < until.getTime()) {
    vi.advanceTimersByTime(Math.min(timeStepMs, until.getTime() - Date.now()));
    await t.finishInProgressScheduledFunctions();
  }
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
