import { convexTest } from "convex-test";
import { vi } from "vitest";
import schema from "../convex/schema";
import { modules } from "../convex/test.setup";
import { signedRequest } from "./signedSlack";
import { messageChangedEvent, messageDeletedEvent, messageEvent, type EditOptions, type MessageOptions, type RichElement } from "./slackMessages";

export type Backend = ReturnType<typeof testBackend>;

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

export async function settle(t: Backend) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

export async function kudosReceived(t: Backend, user: string) {
  return t.run(async (ctx) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", "T1").eq("user", user))
      .unique();
    if (member === null) return 0;
    const awards = await ctx.db
      .query("awards")
      .withIndex("by_recipient", (q) => q.eq("recipient", member._id))
      .collect();
    return awards.reduce((sum, award) => sum + award.kudos, 0);
  });
}

export async function everythingStored(t: Backend) {
  return t.run(async (ctx) => {
    const tables = await Promise.all(Object.keys(schema.tables).map((table) => ctx.db.query(table as keyof typeof schema.tables).collect()));
    return tables.flat();
  });
}
