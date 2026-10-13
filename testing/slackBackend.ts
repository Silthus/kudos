import { convexTest } from "convex-test";
import { vi } from "vitest";
import schema from "../convex/schema";
import { modules } from "../convex/test.setup";
import { signedRequest } from "./signedSlack";
import { memberEvent, messageChangedEvent, messageDeletedEvent, messageEvent, type EditOptions, type MessageOptions, type RichElement } from "./slackMessages";

export type Backend = ReturnType<typeof testBackend>;

const realSetTimeout = globalThis.setTimeout;
const idleAfterMs = 200;

export function testBackend() {
  return convexTest(schema, modules);
}

export async function post(t: Backend, blocks: RichElement[], options: MessageOptions = {}) {
  return t.fetch("/slack/events", await signedRequest(messageEvent(blocks, options)));
}

export async function edit(t: Backend, blocks: RichElement[], options: EditOptions = {}) {
  return t.fetch("/slack/events", await signedRequest(messageChangedEvent(blocks, options)));
}

export async function deleteMessage(t: Backend, options: Parameters<typeof messageDeletedEvent>[0] = {}) {
  return t.fetch("/slack/events", await signedRequest(messageDeletedEvent(options)));
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

export async function everythingStored(t: Backend) {
  return t.run(async (ctx) => {
    const tables = await Promise.all(Object.keys(schema.tables).map((table) => ctx.db.query(table as keyof typeof schema.tables).collect()));
    return tables.flat();
  });
}
