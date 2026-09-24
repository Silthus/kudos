import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { memberships, publicSettings } from "./lib/access";
import { siteUrl } from "./lib/slack";
import { storeOpen } from "./lib/store";

/** Who is looking at the web app, and what they're allowed to see. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { status: "signedOut" as const };
    const usable = await memberships(ctx, userId);
    if (!usable.length) {
      const user = await ctx.db.get(userId);
      return { status: "notInstalled" as const, name: user?.name ?? null, slackTeamId: user?.slackTeamId ?? null };
    }
    const [{ member, workspace }] = usable;
    return {
      // Every workspace this user can switch to, the current one first.
      workspaces: usable.map((m) => ({
        memberId: m.member._id,
        // What links from Slack name (`?ws=`, lib/links.ts): only ever the viewer's own workspaces.
        slackTeamId: m.workspace.slackTeamId,
        name: m.workspace.name,
        iconUrl: m.workspace.iconUrl ?? null,
        current: m.member._id === member._id,
      })),
      status: "ready" as const,
      member: {
        _id: member._id,
        name: member.name,
        title: member.title,
        avatarUrl: member.avatarUrl,
        slackUserId: member.slackUserId,
        isAdmin: member.isAdmin,
        gameHidden: Boolean(member.gameHidden),
      },
      workspace: {
        _id: workspace._id,
        name: workspace.name,
        iconUrl: workspace.iconUrl,
        isDemo: workspace.isDemo,
        ...publicSettings(workspace),
        storeEnabled: storeOpen(workspace),
      },
      canSeeOwnReceived: workspace.receivedVisibility !== "hidden",
      canSeeOthersReceived: workspace.receivedVisibility === "everyone",
    };
  },
});

/** Shows another of the signed-in user's workspaces from now on (see `memberships`). */
export const switchWorkspace = mutation({
  args: { memberId: v.id("members") },
  returns: v.null(),
  handler: async (ctx, { memberId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in with Slack to continue.");
    const usable = await memberships(ctx, userId);
    if (!usable.some((m) => m.member._id === memberId)) throw new ConvexError("You can't switch to that workspace.");
    await ctx.db.patch(memberId, { activeAt: Date.now() });
    return null;
  },
});

/** Public, secret-free setup status for the install page. */
export const setupStatus = query({
  args: {},
  returns: v.object({
    siteUrl: v.string(),
    slackClientId: v.boolean(),
    slackClientSecret: v.boolean(),
    slackSigningSecret: v.boolean(),
    demoEnabled: v.boolean(),
  }),
  handler: async () => ({
    siteUrl: siteUrl(),
    slackClientId: Boolean(process.env.SLACK_CLIENT_ID),
    slackClientSecret: Boolean(process.env.SLACK_CLIENT_SECRET),
    slackSigningSecret: Boolean(process.env.SLACK_SIGNING_SECRET),
    demoEnabled: process.env.DEMO_MODE === "true",
  }),
});
