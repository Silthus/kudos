import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { memberships, publicSettings } from "./lib/access";
import { siteUrl } from "./lib/slack";
import { WALLET_LEVEL } from "./lib/coins";
import { realRewardsOn } from "./lib/items";
import { gameShownTo, playerOf } from "./game";

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
        // The workspace clock (lib/time.ts workspaceNow): the web client adds it to compute today (src/lib/period.ts).
        clockOffsetMs: workspace.clockOffsetMs ?? 0,
        ...publicSettings(workspace),
        // The Store is the place to spend Hog coins, so it appears with the wallet (level 3),
        // visible but locked until level 5 (§G1); never while the game is off or hidden.
        storeEnabled: gameShownTo(workspace, member) && ((await playerOf(ctx, member._id))?.level ?? 1) >= WALLET_LEVEL,
        realRewardsEnabled: realRewardsOn(workspace),
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
    const chosen = usable.find((m) => m.member._id === memberId);
    if (!chosen) throw new ConvexError("You can't switch to that workspace.");
    // A simulator is shown or not per visitor (lib/access.ts simulatorOf); other workspaces go by recency.
    const simulator = usable.find((m) => m.workspace.simulator);
    if (simulator) await ctx.db.patch(simulator.workspace._id, { simulator: { ...simulator.workspace.simulator!, shown: chosen === simulator } });
    if (chosen !== simulator) await ctx.db.patch(memberId, { activeAt: Date.now() });
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
