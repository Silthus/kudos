import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { emojiNameOf } from "./settingsBounds";

export type WorkspaceSettings = { baseAllowance: number; kudosEmoji: string; announcementChannel: string | null };

const defaultBaseAllowance = 3;
const fallbackKudosEmoji = "taco";
const defaultHugBudget = 10;

export async function settingsOf(ctx: QueryCtx, workspace: string): Promise<WorkspaceSettings> {
  const row = await workspaceRow(ctx, workspace);
  return {
    baseAllowance: row?.baseAllowance ?? defaultBaseAllowance,
    kudosEmoji: row?.kudosEmoji ?? defaultKudosEmoji(),
    announcementChannel: row?.announcementChannel ?? null,
  };
}

export async function hugBudgetOf(ctx: QueryCtx, workspace: string): Promise<number> {
  return (await workspaceRow(ctx, workspace))?.hugBudget ?? defaultHugBudget;
}

export async function welcomeNudgeOn(ctx: QueryCtx, workspace: string): Promise<boolean> {
  return (await welcomeNudgeSwitchIn(ctx, workspace))?.on ?? true;
}

export async function saveWelcomeNudge(ctx: MutationCtx, workspace: string, on: boolean): Promise<void> {
  const saved = await welcomeNudgeSwitchIn(ctx, workspace);
  if (saved === null) await ctx.db.insert("welcomeNudgeSwitches", { workspace, on });
  else await ctx.db.patch(saved._id, { on });
}

function welcomeNudgeSwitchIn(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("welcomeNudgeSwitches")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}

export const setHugBudget = internalMutation({
  args: { workspace: v.string(), hugBudget: v.number() },
  handler: async (ctx, { workspace, hugBudget }) => {
    if (!Number.isInteger(hugBudget) || hugBudget < 0) throw new Error("A hug budget is a whole number of hugs, 0 or more");
    const row = await workspaceRow(ctx, workspace);
    if (row === null) throw new Error(`Kudos knows no workspace ${workspace}`);
    await ctx.db.patch(row._id, { hugBudget });
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

function saveAnnouncementChannel(ctx: MutationCtx, workspace: string, announcementChannel: string | undefined) {
  return saveWorkspaceSettings(ctx, workspace, { announcementChannel });
}

export async function saveWorkspaceSettings(ctx: MutationCtx, workspace: string, settings: Partial<Omit<Doc<"workspaces">, "_id" | "_creationTime" | "workspace">>) {
  const row = await workspaceRow(ctx, workspace);
  if (row === null) await ctx.db.insert("workspaces", { workspace, ...settings });
  else await ctx.db.patch(row._id, settings);
}

function workspaceRow(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("workspaces")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}

export function defaultKudosEmoji() {
  return emojiNameOf(process.env.KUDOS_EMOJI ?? "") || fallbackKudosEmoji;
}
