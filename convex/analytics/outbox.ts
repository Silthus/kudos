import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { captureSettings, nativeErrorReportingOn } from "./capture";
import { wakeDrain } from "./drain";
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
      failures: 0,
      dueAt: Date.now(),
    });
  }
  await wakeDrain(ctx);
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
    failures: 0,
    dueAt: Date.now(),
  });
  await wakeDrain(ctx);
  return true;
}

async function deploymentWorkspaceKey(ctx: QueryCtx) {
  const keys = await ctx.db.query("workspaceKeys").take(2);
  return keys.length === 1 ? keys[0]!.workspaceKey : null;
}

export async function analyticsIdOf(ctx: MutationCtx, member: MemberId) {
  const existing = await existingAnalyticsId(ctx, member);
  if (existing !== null) return existing;
  const analyticsId = crypto.randomUUID();
  await ctx.db.insert("analyticsIds", { member, analyticsId });
  return analyticsId;
}

export async function existingAnalyticsId(ctx: QueryCtx, member: MemberId) {
  const row = await ctx.db
    .query("analyticsIds")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
  return row?.analyticsId ?? null;
}

export async function workspaceKeyOf(ctx: MutationCtx, workspace: string) {
  const existing = await existingWorkspaceKey(ctx, workspace);
  if (existing !== null) return existing;
  const workspaceKey = crypto.randomUUID();
  await ctx.db.insert("workspaceKeys", { workspace, workspaceKey });
  return workspaceKey;
}

export async function existingWorkspaceKey(ctx: QueryCtx, workspace: string) {
  const row = await ctx.db
    .query("workspaceKeys")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
  return row?.workspaceKey ?? null;
}
