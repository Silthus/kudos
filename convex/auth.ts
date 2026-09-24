import Slack from "@auth/core/providers/slack";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { convexAuth } from "@convex-dev/auth/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

type SlackOidcProfile = {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
  "https://slack.com/user_id"?: string;
  "https://slack.com/team_id"?: string;
};

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    // "Sign in with Slack" (OpenID Connect) — uses the same Slack app as the bot.
    Slack({
      clientId: process.env.SLACK_CLIENT_ID,
      clientSecret: process.env.SLACK_CLIENT_SECRET,
      profile(p: SlackOidcProfile) {
        return {
          id: p.sub,
          name: p.name,
          email: p.email,
          image: p.picture,
          slackUserId: p["https://slack.com/user_id"] ?? p.sub,
          slackTeamId: p["https://slack.com/team_id"],
        };
      },
    }),
    // One-click entry into the seeded demo workspace. Disabled unless DEMO_MODE=true.
    ConvexCredentials({
      id: "demo",
      authorize: async (_credentials, ctx) => {
        if (process.env.DEMO_MODE !== "true") return null;
        const userId: Id<"users"> = await ctx.runMutation(internal.demo.ensureDemoUser, {});
        return { userId };
      },
    }),
  ],
  callbacks: {
    // Slack identities are per-workspace, so never link accounts by email.
    async createOrUpdateUser(ctx, args) {
      const db = (ctx as unknown as MutationCtx).db;
      if (args.existingUserId) {
        const userId = args.existingUserId as Id<"users">;
        if (args.provider.id === "slack") {
          await db.patch(userId, slackUserFields(args.profile));
          await linkSlackMember(ctx as unknown as MutationCtx, userId, args.profile);
        }
        return userId;
      }
      if (args.provider.id !== "slack") {
        throw new Error(`Unsupported sign-in provider: ${args.provider.id}`);
      }
      const userId = await db.insert("users", slackUserFields(args.profile));
      await linkSlackMember(ctx as unknown as MutationCtx, userId, args.profile);
      return userId;
    },
  },
});

function slackUserFields(profile: Record<string, unknown>) {
  const str = (k: string) => (typeof profile[k] === "string" ? (profile[k] as string) : undefined);
  return {
    name: str("name"),
    email: str("email"),
    image: str("image"),
    slackUserId: str("slackUserId"),
    slackTeamId: str("slackTeamId"),
  };
}

/** Attach the Slack identity to its member row in an installed workspace (if any). */
export async function linkSlackMember(ctx: MutationCtx, userId: Id<"users">, profile: Record<string, unknown>) {
  const { slackUserId, slackTeamId, name, image } = slackUserFields(profile);
  if (!slackUserId || !slackTeamId) return;
  const workspace = await ctx.db
    .query("workspaces")
    .withIndex("by_team", (q) => q.eq("slackTeamId", slackTeamId))
    .unique();
  if (!workspace || workspace.status !== "active") return;
  const member = await ctx.db
    .query("members")
    .withIndex("by_workspace_slackUser", (q) =>
      q.eq("workspaceId", workspace._id).eq("slackUserId", slackUserId),
    )
    .unique();
  if (member) {
    await ctx.db.patch(member._id, { userId, avatarUrl: member.avatarUrl ?? image, activeAt: Date.now() });
  } else {
    await ctx.db.insert("members", {
      workspaceId: workspace._id,
      slackUserId,
      name: name ?? "Teammate",
      avatarUrl: image,
      isAdmin: false,
      isBot: false,
      deactivated: false,
      userId,
      activeAt: Date.now(),
      totalGiven: 0,
      totalReceived: 0,
      totalMaxedDays: 0,
    });
    await ctx.scheduler.runAfter(0, internal.slack.syncMember, {
      workspaceId: workspace._id,
      slackUserId,
    });
  }
}
