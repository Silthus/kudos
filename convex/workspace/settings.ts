import type { QueryCtx } from "../_generated/server";

export type WorkspaceSettings = { baseAllowance: number; kudosEmoji: string };

const defaultBaseAllowance = 3;
const fallbackKudosEmoji = "taco";

export async function settingsOf(ctx: QueryCtx, workspace: string): Promise<WorkspaceSettings> {
  const row = await ctx.db
    .query("workspaces")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
  return {
    baseAllowance: row?.baseAllowance ?? defaultBaseAllowance,
    kudosEmoji: row?.kudosEmoji ?? defaultKudosEmoji(),
  };
}

export function defaultKudosEmoji() {
  const configured = process.env.KUDOS_EMOJI?.trim().replace(/^:|:$/g, "");
  return configured || fallbackKudosEmoji;
}
