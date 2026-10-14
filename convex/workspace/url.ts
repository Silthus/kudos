import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";

const requestExpiresAfterMs = 10 * 60 * 1000;

export async function workspaceUrlOf(ctx: QueryCtx, workspace: string): Promise<string | null> {
  return (await workspaceRow(ctx, workspace))?.url ?? null;
}

export async function claimWorkspaceUrlRequest(ctx: MutationCtx, workspace: string): Promise<boolean> {
  const row = await workspaceRow(ctx, workspace);
  if (row?.url !== undefined || isPending(row?.urlRequestedAt)) return false;
  if (row === null) await ctx.db.insert("workspaces", { workspace, urlRequestedAt: Date.now() });
  else await ctx.db.patch(row._id, { urlRequestedAt: Date.now() });
  return true;
}

export const rememberWorkspaceUrl = internalMutation({
  args: { workspace: v.string(), url: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { workspace, url }) => {
    const workspaceUrl = slackWorkspaceUrlOf(url);
    if (workspaceUrl === null) return false;
    const row = await workspaceRow(ctx, workspace);
    if (row === null) await ctx.db.insert("workspaces", { workspace, url: workspaceUrl });
    else await ctx.db.patch(row._id, { url: workspaceUrl, urlRequestedAt: undefined });
    return true;
  },
});

export const releaseWorkspaceUrlRequest = internalMutation({
  args: { workspace: v.string() },
  returns: v.null(),
  handler: async (ctx, { workspace }) => {
    const row = await workspaceRow(ctx, workspace);
    if (row?.urlRequestedAt !== undefined) await ctx.db.patch(row._id, { urlRequestedAt: undefined });
    return null;
  },
});

function isPending(requestedAt: number | undefined) {
  return requestedAt !== undefined && Date.now() - requestedAt < requestExpiresAfterMs;
}

function slackWorkspaceUrlOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? `${parsed.origin}/` : null;
  } catch {
    return null;
  }
}

function workspaceRow(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("workspaces")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}
