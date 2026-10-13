import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { captureSettings } from "./capture";
import { wakeDrain } from "./drain";
import type { ProductEvent } from "./projections";

const taxonomyVersion = 1;

export async function record(ctx: MutationCtx, workspace: string, events: ProductEvent[]) {
  const capture = captureSettings();
  if (capture === null) return;
  const shared = { environment: capture.environment, workspace_key: await workspaceKeyOf(ctx, workspace), taxonomy_version: taxonomyVersion };
  for (const { event, subject, at, properties } of events) {
    await ctx.db.insert("analyticsOutbox", {
      uuid: crypto.randomUUID(),
      event,
      distinctId: await analyticsIdOf(ctx, subject.member),
      timestamp: at,
      properties: { ...properties, ...shared },
      state: "pending",
      failures: 0,
      dueAt: Date.now(),
    });
  }
  await wakeDrain(ctx);
}

async function analyticsIdOf(ctx: MutationCtx, member: MemberId) {
  const existing = await ctx.db
    .query("analyticsIds")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
  if (existing !== null) return existing.analyticsId;
  const analyticsId = crypto.randomUUID();
  await ctx.db.insert("analyticsIds", { member, analyticsId });
  return analyticsId;
}

async function workspaceKeyOf(ctx: MutationCtx, workspace: string) {
  const existing = await workspaceKeyRow(ctx, workspace);
  if (existing !== null) return existing.workspaceKey;
  const workspaceKey = crypto.randomUUID();
  await ctx.db.insert("workspaceKeys", { workspace, workspaceKey });
  return workspaceKey;
}

function workspaceKeyRow(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("workspaceKeys")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}
