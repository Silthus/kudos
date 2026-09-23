import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { getViewer, publicSettings } from "./lib/access";
import { siteUrl } from "./lib/slack";

/** Who is looking at the web app, and what they're allowed to see. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { status: "signedOut" as const };
    const viewer = await getViewer(ctx);
    if (!viewer) {
      const user = await ctx.db.get(userId);
      return { status: "notInstalled" as const, name: user?.name ?? null, slackTeamId: user?.slackTeamId ?? null };
    }
    const { member, workspace } = viewer;
    return {
      status: "ready" as const,
      member: {
        _id: member._id,
        name: member.name,
        title: member.title,
        avatarUrl: member.avatarUrl,
        slackUserId: member.slackUserId,
        isAdmin: member.isAdmin,
      },
      workspace: {
        _id: workspace._id,
        name: workspace.name,
        iconUrl: workspace.iconUrl,
        isDemo: workspace.isDemo,
        ...publicSettings(workspace),
      },
      canSeeOwnReceived: workspace.receivedVisibility !== "hidden",
      canSeeOthersReceived: workspace.receivedVisibility === "everyone",
    };
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
