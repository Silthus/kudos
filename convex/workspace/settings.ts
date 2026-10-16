import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { xpLevelsShownIn } from "../progression/xpLevels";

export type WorkspaceSettings = { baseAllowance: number; kudosEmoji: string; announcementChannel: string | null };

const defaultBaseAllowance = 3;
const fallbackKudosEmoji = "taco";
const defaultStarBudget = 10;

export async function settingsOf(ctx: QueryCtx, workspace: string): Promise<WorkspaceSettings> {
  const row = await workspaceRow(ctx, workspace);
  return {
    baseAllowance: row?.baseAllowance ?? defaultBaseAllowance,
    kudosEmoji: row?.kudosEmoji ?? defaultKudosEmoji(),
    announcementChannel: row?.announcementChannel ?? null,
  };
}

export async function starBudgetOf(ctx: QueryCtx, workspace: string): Promise<number> {
  return (await workspaceRow(ctx, workspace))?.starBudget ?? defaultStarBudget;
}

export const setStarBudget = internalMutation({
  args: { workspace: v.string(), starBudget: v.number() },
  handler: async (ctx, { workspace, starBudget }) => {
    if (!Number.isInteger(starBudget) || starBudget < 0) throw new Error("A star budget is a whole number of stars, 0 or more");
    const row = await workspaceRow(ctx, workspace);
    if (row === null) throw new Error(`Kudos knows no workspace ${workspace}`);
    await ctx.db.patch(row._id, { starBudget });
  },
});

export const pickAnnouncementChannel = internalMutation({
  args: { workspace: v.string(), channel: v.union(v.string(), v.null()) },
  handler: async (ctx, { workspace, channel }): Promise<boolean> => {
    if ((await workspaceRow(ctx, workspace)) === null) throw new Error(`Kudos knows no workspace ${workspace}`);
    return announceIn(ctx, workspace, channel);
  },
});

export async function setAnnouncementChannel(ctx: MutationCtx, workspace: string, person: { admin: boolean }, channel: string | null): Promise<void> {
  if (person.admin) await announceIn(ctx, workspace, channel);
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
