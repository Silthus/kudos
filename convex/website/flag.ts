import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { flag, type Flag } from "../analytics/flags";
import { workspaceKeyOf } from "../analytics/outbox";
import { signInWorkspace } from "../slack/signIn";

export const websiteFlag = { key: "website", subject: "workspace", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean, "workspace">;

export async function websiteOpen(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const workspace = signInWorkspace();
  if (workspace === undefined) return false;
  return flag(ctx, websiteFlag, { workspace });
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
