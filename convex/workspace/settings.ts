import type { QueryCtx } from "../_generated/server";

export type WorkspaceSettings = { baseAllowance: number; kudosEmoji: string };

const defaultBaseAllowance = 3;
export const defaultKudosEmoji = "taco";

export async function settingsOf(ctx: QueryCtx, workspace: string): Promise<WorkspaceSettings> {
  const row = await ctx.db
    .query("workspaces")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
  return {
    baseAllowance: row?.baseAllowance ?? defaultBaseAllowance,
    kudosEmoji: row?.kudosEmoji ?? deploymentKudosEmoji(),
  };
}

function deploymentKudosEmoji() {
  const configured = process.env.KUDOS_EMOJI?.trim().replace(/^:|:$/g, "");
  return configured || defaultKudosEmoji;
}
