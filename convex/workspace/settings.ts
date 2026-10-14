import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { xpLevelsShownIn } from "../progression/xpLevels";

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

export const pickAnnouncementChannel = internalMutation({
  args: { workspace: v.string(), channel: v.union(v.string(), v.null()) },
  handler: (ctx, { workspace, channel }): Promise<boolean> => announceIn(ctx, workspace, channel),
});

export async function setAnnouncementChannel(ctx: MutationCtx, workspace: string, person: { admin: boolean }, channel: string | null): Promise<boolean> {
  return person.admin && (await announceIn(ctx, workspace, channel));
}

async function announceIn(ctx: MutationCtx, workspace: string, channel: string | null): Promise<boolean> {
  if (!(await xpLevelsShownIn(ctx, workspace))) return false;
  await saveAnnouncementChannel(ctx, workspace, channel ?? undefined);
  await ctx.scheduler.runAfter(0, internal.feedback.homes.republishAdminsIn, { workspace });
  return true;
}

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
