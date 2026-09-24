import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type Viewer = { member: Doc<"members">; workspace: Doc<"workspaces"> };

/** More memberships than one person plausibly has; beyond it the oldest links are ignored. */
const MAX_MEMBERSHIPS = 50;

/**
 * Every workspace `userId` can use (active member, installed workspace), the one they see first:
 * the one they last chose (`activeAt`: Slack sign-in or the switcher), else the one they last gave
 * kudos in, else the newest membership. Never index order, so the choice is deterministic.
 */
export async function memberships(ctx: QueryCtx, userId: Id<"users">): Promise<Viewer[]> {
  const members = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(MAX_MEMBERSHIPS);
  const usable: Viewer[] = [];
  for (const member of members) {
    if (member.deactivated) continue;
    const workspace = await ctx.db.get(member.workspaceId);
    if (workspace?.status === "active") usable.push({ member, workspace });
  }
  const recency = ({ member }: Viewer) => [member.activeAt ?? 0, member.lastGivenAt ?? 0, member._creationTime];
  return usable.sort((a, b) => {
    const [ra, rb] = [recency(a), recency(b)];
    return rb[0] - ra[0] || rb[1] - ra[1] || rb[2] - ra[2];
  });
}

/** The signed-in user's workspace membership, or null when signed out / not linked. */
export async function getViewer(ctx: QueryCtx): Promise<Viewer | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const [current] = await memberships(ctx, userId);
  return current ?? null;
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

/** Everyone shares the demo admin account, so its configuration stays fixed. */
export function assertNotDemo(workspace: Doc<"workspaces">, what = "Settings are") {
  if (workspace.isDemo) throw new ConvexError(`${what} read-only in the shared demo workspace.`);
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
    questsEnabled: w.questsEnabled ?? true,
  };
}
