import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { workspaceDecision, workspaceDecisionWithoutWriting, type Flag } from "../analytics/flags";
import { workspaceKeyOf } from "../analytics/outbox";
import { signInWorkspace } from "../slack/signIn";

export const websiteFlag = { key: "website", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function websiteOpen(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  return websiteFlagThrough(ctx, workspaceDecision);
}

export function websiteOpenWithoutWriting(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  return websiteFlagThrough(ctx, workspaceDecisionWithoutWriting);
}

async function websiteFlagThrough(ctx: QueryCtx | MutationCtx, read: typeof workspaceDecision): Promise<boolean> {
  const workspace = signInWorkspace();
  if (workspace === undefined) return false;
  return read(ctx, websiteFlag, workspace);
}

export const prepareWebsiteFlag = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const workspace = signInWorkspace();
    if (workspace !== undefined) await workspaceKeyOf(ctx, workspace);
    return null;
  },
});
