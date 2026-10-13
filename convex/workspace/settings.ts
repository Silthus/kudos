import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { setAnnouncementChannelCommand, type CommandResult } from "../bus/commands";
import { chatUserOf, isAdmin } from "./directory";

export type WorkspaceSettings = { baseAllowance: number; kudosEmoji: string; announcementChannel: string | null };

const defaults: WorkspaceSettings = { baseAllowance: 3, kudosEmoji: "taco", announcementChannel: null };

export async function settingsOf(ctx: QueryCtx, workspace: string): Promise<WorkspaceSettings> {
  const row = await workspaceRow(ctx, workspace);
  return {
    baseAllowance: row?.baseAllowance ?? defaults.baseAllowance,
    kudosEmoji: row?.kudosEmoji ?? defaults.kudosEmoji,
    announcementChannel: row?.announcementChannel ?? defaults.announcementChannel,
  };
}

export const setAnnouncementChannel = internalMutation({
  args: { command: setAnnouncementChannelCommand },
  handler: async (ctx, { command: { member, channel } }): Promise<CommandResult> => {
    if (!(await isAdmin(ctx, member))) return "refused";
    const { workspace } = await chatUserOf(ctx, member);
    await saveAnnouncementChannel(ctx, workspace, channel ?? undefined);
    return "done";
  },
});

async function saveAnnouncementChannel(ctx: MutationCtx, workspace: string, announcementChannel: string | undefined) {
  const row = await workspaceRow(ctx, workspace);
  if (row === null) await ctx.db.insert("workspaces", { workspace, announcementChannel });
  else await ctx.db.patch(row._id, { announcementChannel });
}

function workspaceRow(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("workspaces")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}
