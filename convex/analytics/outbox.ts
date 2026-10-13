import { internal } from "../_generated/api";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { captureSettings, nativeErrorReportingOn } from "./capture";
import type { Exception } from "./exceptions";
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
    });
  }
  await startDrain(ctx);
}

export type FailedFunction = { path: string; kind: "http" | "action" | "mutation" };

export async function recordException(ctx: MutationCtx, failed: FailedFunction, exception: Exception, at: number): Promise<boolean> {
  const capture = captureSettings();
  if (capture === null || nativeErrorReportingOn()) return false;
  const workspaceKey = await deploymentWorkspaceKey(ctx);
  await ctx.db.insert("analyticsOutbox", {
    uuid: crypto.randomUUID(),
    event: "$exception",
    distinctId: `deployment:${capture.environment}`,
    timestamp: at,
    properties: {
      environment: capture.environment,
      ...(workspaceKey !== null && { workspace_key: workspaceKey }),
      taxonomy_version: taxonomyVersion,
      function_path: failed.path,
      function_kind: failed.kind,
    },
    exception,
    state: "pending",
  });
  await startDrain(ctx);
  return true;
}

async function deploymentWorkspaceKey(ctx: QueryCtx) {
  const keys = await ctx.db.query("workspaceKeys").take(2);
  return keys.length === 1 ? keys[0]!.workspaceKey : null;
}

async function startDrain(ctx: MutationCtx) {
  if ((await ctx.db.query("analyticsDrain").first()) !== null) return;
  await ctx.db.insert("analyticsDrain", {});
  await ctx.scheduler.runAfter(0, internal.analytics.drain.drain, {});
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
