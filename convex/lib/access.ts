import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type Viewer = { member: Doc<"members">; workspace: Doc<"workspaces"> };

/** The signed-in user's workspace membership, or null when signed out / not linked. */
export async function getViewer(ctx: QueryCtx): Promise<Viewer | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const member = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (!member || member.deactivated) return null;
  const workspace = await ctx.db.get(member.workspaceId);
  if (!workspace || workspace.status !== "active") return null;
  return { member, workspace };
}

export async function requireViewer(ctx: QueryCtx): Promise<Viewer> {
  const viewer = await getViewer(ctx);
  if (!viewer) throw new ConvexError("Sign in with Slack to continue.");
  return viewer;
}

export async function requireAdmin(ctx: QueryCtx): Promise<Viewer> {
  const viewer = await requireViewer(ctx);
  if (!viewer.member.isAdmin) throw new ConvexError("Only workspace admins can do that.");
  return viewer;
}

/** Whether `viewer` may see received counts for `subjectMemberId`. */
export function canSeeReceived(viewer: Viewer, subjectMemberId?: string): boolean {
  switch (viewer.workspace.receivedVisibility) {
    case "everyone":
      return true;
    case "self":
      return subjectMemberId === viewer.member._id;
    case "hidden":
      return false;
  }
}

export function publicMember(m: Doc<"members">) {
  return {
    _id: m._id,
    slackUserId: m.slackUserId,
    name: m.name,
    realName: m.realName,
    title: m.title,
    avatarUrl: m.avatarUrl,
  };
}

export function publicSettings(w: Doc<"workspaces">) {
  return {
    emojiName: w.emojiName,
    emojiGlyph: w.emojiGlyph,
    unitSingular: w.unitSingular,
    unitPlural: w.unitPlural,
    dailyLimit: w.dailyLimit,
    timezone: w.timezone,
    receivedVisibility: w.receivedVisibility,
    reactionsEnabled: w.reactionsEnabled,
    notifyGiver: w.notifyGiver,
    notifyReceiver: w.notifyReceiver,
  };
}
