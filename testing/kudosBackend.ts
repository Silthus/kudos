import { convexTest } from "convex-test";
import { vi } from "vitest";
import schema from "../convex/schema";
import { modules } from "../convex/test.setup";
import { signedRequest } from "./signedSlack";
import { messageEvent, type MessageOptions, type RichElement } from "./slackMessages";

export type Backend = ReturnType<typeof testBackend>;

export function testBackend() {
  return convexTest(schema, modules);
}

export async function postMessage(t: Backend, blocks: RichElement[], options: MessageOptions = {}) {
  return t.fetch("/slack/events", await signedRequest(messageEvent(blocks, options)));
}

export async function settle(t: Backend) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
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
