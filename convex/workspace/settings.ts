import type { QueryCtx } from "../_generated/server";

export type WorkspaceSettings = { baseAllowance: number; kudosEmoji: string; announcementChannel: string | null };

const defaults: WorkspaceSettings = { baseAllowance: 3, kudosEmoji: "taco", announcementChannel: null };

export async function settingsOf(ctx: QueryCtx, workspace: string): Promise<WorkspaceSettings> {
  const row = await ctx.db
    .query("workspaces")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
  return {
    baseAllowance: row?.baseAllowance ?? defaults.baseAllowance,
    kudosEmoji: row?.kudosEmoji ?? defaults.kudosEmoji,
    announcementChannel: row?.announcementChannel ?? defaults.announcementChannel,
  };
}
