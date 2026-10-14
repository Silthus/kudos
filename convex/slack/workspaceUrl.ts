import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { claimWorkspaceUrlRequest } from "../workspace/url";
import { readSlack, slackErrorCodeOf } from "./webApi";

type Identity = { url?: unknown; team_id?: unknown };

export async function fillWorkspaceUrlLater(ctx: MutationCtx, workspace: string) {
  if (await claimWorkspaceUrlRequest(ctx, workspace)) await ctx.scheduler.runAfter(0, internal.slack.workspaceUrl.fillWorkspaceUrl, { workspace });
}

export const fillWorkspaceUrl = observedAction({
  args: { workspace: v.optional(v.string()) },
  handler: async (ctx, { workspace }) => {
    let remembered = false;
    try {
      remembered = await rememberedWorkspaceUrl(ctx);
    } finally {
      if (!remembered && workspace !== undefined) await ctx.runMutation(internal.workspace.url.releaseWorkspaceUrlRequest, { workspace });
    }
  },
});

async function rememberedWorkspaceUrl(ctx: ActionCtx): Promise<boolean> {
  const identity = await readSlack<Identity>("auth.test", {});
  if (!identity.ok) {
    console.warn("slack.workspace_url_not_read", { error: slackErrorCodeOf(identity.error) });
    return false;
  }
  if (typeof identity.url !== "string" || typeof identity.team_id !== "string") return false;
  return ctx.runMutation(internal.workspace.url.rememberWorkspaceUrl, { workspace: identity.team_id, url: identity.url });
}
