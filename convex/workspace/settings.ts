import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { setAnnouncementChannelCommand, type CommandResult } from "../bus/commands";
import { chatUserOf, isAdmin } from "./directory";

export type WorkspaceSettings = { baseAllowance: number; kudosEmoji: string; announcementChannel: string | null };

const defaultBaseAllowance = 3;
const fallbackKudosEmoji = "taco";

export async function settingsOf(ctx: QueryCtx, workspace: string): Promise<WorkspaceSettings> {
  const row = await workspaceRow(ctx, workspace);
  return {
    baseAllowance: row?.baseAllowance ?? defaultBaseAllowance,
    kudosEmoji: row?.kudosEmoji ?? defaultKudosEmoji(),
    announcementChannel: row?.announcementChannel ?? null,
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

export function defaultKudosEmoji() {
  const configured = process.env.KUDOS_EMOJI?.trim().toLowerCase().replace(/^:|:$/g, "");
  return configured || fallbackKudosEmoji;
}
