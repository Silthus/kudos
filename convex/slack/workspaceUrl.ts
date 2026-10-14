import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { workspaceUrlOf } from "../workspace/url";
import { readSlack, slackErrorCodeOf } from "./webApi";

type Identity = { url?: unknown; team_id?: unknown };

export async function fillWorkspaceUrlLater(ctx: MutationCtx, workspace: string) {
  if ((await workspaceUrlOf(ctx, workspace)) === null) await ctx.scheduler.runAfter(0, internal.slack.workspaceUrl.fillWorkspaceUrl, {});
}

export const fillWorkspaceUrl = observedAction({
  args: {},
  handler: async (ctx) => {
    const identity = await readSlack<Identity>("auth.test", {});
    if (!identity.ok) {
      console.warn("slack.workspace_url_not_read", { error: slackErrorCodeOf(identity.error) });
      return;
    }
    if (typeof identity.url !== "string" || typeof identity.team_id !== "string") return;
    await ctx.runMutation(internal.workspace.url.rememberWorkspaceUrl, { workspace: identity.team_id, url: identity.url });
  },
});
