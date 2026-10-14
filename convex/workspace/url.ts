import { v } from "convex/values";
import { internalMutation, type QueryCtx } from "../_generated/server";

export async function workspaceUrlOf(ctx: QueryCtx, workspace: string): Promise<string | null> {
  return (await workspaceRow(ctx, workspace))?.url ?? null;
}

export const rememberWorkspaceUrl = internalMutation({
  args: { workspace: v.string(), url: v.string() },
  returns: v.null(),
  handler: async (ctx, { workspace, url }) => {
    const workspaceUrl = slackWorkspaceUrlOf(url);
    if (workspaceUrl === null) return null;
    const row = await workspaceRow(ctx, workspace);
    if (row === null) await ctx.db.insert("workspaces", { workspace, url: workspaceUrl });
    else await ctx.db.patch(row._id, { url: workspaceUrl });
    return null;
  },
});

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
