import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { revokeKudosRow } from "./engine";
import { switchQuests } from "./quests";
import { anchorSuccessBaseline } from "./analytics";
import { gameOn, playerOf, switchGame } from "./game";
import { retimeBoosts } from "./boosts";
import { assertNotDemo, canSeeReceived, publicSettings, requireAdmin } from "./lib/access";
import { siteUrl } from "./lib/slack";
import { coinBalance } from "./lib/coins";
import { receivedVisibilityValidator } from "./schema";
import { dayKeyFor } from "./lib/time";

/** Workspace settings plus Slack connection health for the admin page. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const { workspace } = await requireAdmin(ctx);
    const install = await ctx.db
      .query("slackInstallations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .unique();
    const site = siteUrl();
    return {
      workspace: { _id: workspace._id, name: workspace.name, isDemo: workspace.isDemo, slackTeamId: workspace.slackTeamId },
      settings: publicSettings(workspace),
      slack: {
        connected: Boolean(install),
        botUserId: install?.botUserId ?? null,
        appId: install?.appId ?? null,
        installedBy: install?.installedBySlackUserId || null,
        endpoints: {
          events: `${site}/slack/events`,
          commands: `${site}/slack/commands`,
          interactions: `${site}/slack/interactions`,
          install: `${site}/slack/install`,
          manifest: `${site}/slack/manifest.json`,
        },
        signingSecretConfigured: Boolean(process.env.SLACK_SIGNING_SECRET),
        oauthConfigured: Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET),
      },
    };
  },
});

function validTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const updateSettings = mutation({
  args: {
    emojiName: v.string(),
    emojiGlyph: v.string(),
    unitSingular: v.string(),
    unitPlural: v.string(),
    dailyLimit: v.number(),
    timezone: v.string(),
    receivedVisibility: receivedVisibilityValidator,
    reactionsEnabled: v.boolean(),
    notifyGiver: v.boolean(),
    notifyReceiver: v.boolean(),
    // Optional: a client that doesn't know the switch leaves quests as they are.
    questsEnabled: v.optional(v.boolean()),
    // Optional, like questsEnabled: the game (XP, levels, ...).
    gameEnabled: v.optional(v.boolean()),
    // Optional, like questsEnabled: kudos sprees (#94).
    spreesEnabled: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { questsEnabled, gameEnabled, ...args }) => {
    const { workspace } = await requireAdmin(ctx);
    assertNotDemo(workspace);
    const emojiName = args.emojiName.trim().replace(/^:|:$/g, "").toLowerCase();
    if (!/^[a-z0-9_+'-]{1,64}$/.test(emojiName)) {
      throw new ConvexError("Use the Slack emoji shortcode, e.g. taco or star-struck.");
    }
    if (!Number.isInteger(args.dailyLimit) || args.dailyLimit < 1 || args.dailyLimit > 100) {
      throw new ConvexError("Daily allowance must be a whole number between 1 and 100.");
    }
    if (!validTimezone(args.timezone)) throw new ConvexError("Unknown timezone.");
    // Scheduled bonus days start at the start of their day in the workspace's timezone.
    if (args.timezone !== workspace.timezone) await retimeBoosts(ctx, workspace, args.timezone, Date.now());
    const glyph = args.emojiGlyph.trim();
    if (glyph.length === 0 || glyph.length > 16) throw new ConvexError("Pick an emoji to show in the web app.");
    const unitSingular = args.unitSingular.trim();
    const unitPlural = args.unitPlural.trim();
    if (!unitSingular || !unitPlural || unitSingular.length > 24 || unitPlural.length > 24) {
      throw new ConvexError("Unit names must be 1–24 characters.");
    }
    await ctx.db.patch(workspace._id, {
      ...args,
      emojiName,
      emojiGlyph: glyph,
      unitSingular,
      unitPlural,
      ...(questsEnabled === undefined ? {} : switchQuests(workspace, questsEnabled, Date.now())),
      ...(gameEnabled === undefined ? {} : switchGame(workspace, gameEnabled, Date.now())),
    });
    // Switched on: play the history through the rules (paused stretches excluded), in the background.
    if (gameEnabled && !gameOn(workspace)) {
      await ctx.scheduler.runAfter(0, internal.game.rebuildWorkspace, { workspaceId: workspace._id });
      // The first launch pins the success metrics' baseline to the months before it.
      await anchorSuccessBaseline(ctx, workspace, dayKeyFor(Date.now(), args.timezone));
    }
    return null;
  },
});

export const members = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireAdmin(ctx);
    const { workspace } = viewer;
    const rows = await ctx.db
      .query("members")
      .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspace._id))
      .take(2000);
    const coinsShown = gameOn(workspace);
    const people = rows.filter((m) => !m.isBot).sort((a, b) => Number(a.deactivated) - Number(b.deactivated) || b.totalGiven - a.totalGiven);
    return await Promise.all(
      people.map(async (m) => ({
        _id: m._id,
        name: m.name,
        title: m.title ?? null,
        avatarUrl: m.avatarUrl ?? null,
        slackUserId: m.slackUserId,
        isAdmin: m.isAdmin,
        deactivated: m.deactivated,
        signedIn: Boolean(m.userId),
        totalGiven: m.totalGiven,
        totalReceived: canSeeReceived(viewer, m._id) ? m.totalReceived : null,
        totalMaxedDays: m.totalMaxedDays,
        lastGivenAt: m.lastGivenAt ?? null,
        // Hog coins (ADR 0002) are private to the member and admins, whatever received visibility
        // says: they come from giving. None while the game is off.
        balance: coinsShown ? coinBalance((await playerOf(ctx, m._id)) ?? { level: 1 }, m).balance : null,
      })),
    );
  },
});

export const setAdmin = mutation({
  args: { memberId: v.id("members"), isAdmin: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { memberId, isAdmin }) => {
    const { workspace, member: me } = await requireAdmin(ctx);
    assertNotDemo(workspace);
    const target = await ctx.db.get(memberId);
    if (!target || target.workspaceId !== workspace._id) throw new ConvexError("Member not found.");
    if (!isAdmin && target._id === me._id) throw new ConvexError("You can't remove your own admin role.");
    if (target.isAdmin === isAdmin) return null;
    // Who removed an admin role is remembered: those four eyes still count for the remover's
    // own store requests (store.ts ownDecisionBlocker). Promoting again forgets it.
    await ctx.db.patch(memberId, { isAdmin, adminRemovedBy: isAdmin ? undefined : me._id });
    return null;
  },
});

export const recentKudos = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const { workspace } = await requireAdmin(ctx);
    const page = await ctx.db
      .query("kudos")
      .withIndex("by_workspace_at", (q) => q.eq("workspaceId", workspace._id))
      .order("desc")
      .paginate(paginationOpts);
    const cache = new Map<Id<"members">, Doc<"members"> | null>();
    const get = async (id: Id<"members">) => {
      if (!cache.has(id)) cache.set(id, await ctx.db.get(id));
      const m = cache.get(id);
      return m ? { name: m.name, avatarUrl: m.avatarUrl ?? null, slackUserId: m.slackUserId } : null;
    };
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (k) => ({
          _id: k._id,
          batchId: k.batchId,
          giver: await get(k.giverId),
          receiver: await get(k.receiverId),
          amount: k.amount,
          channel: k.channelName ?? null,
          text: k.text,
          source: k.source,
          at: k.at,
        })),
      ),
    };
  },
});

/** Removes a kudos (e.g. given by mistake) and keeps every counter consistent. */
export const revoke = mutation({
  args: { kudosId: v.id("kudos") },
  returns: v.null(),
  handler: async (ctx, { kudosId }) => {
    const { workspace } = await requireAdmin(ctx);
    const row = await ctx.db.get(kudosId);
    if (!row || row.workspaceId !== workspace._id) throw new ConvexError("Kudos not found.");
    await revokeKudosRow(ctx, workspace, row);
    return null;
  },
});

export const resyncMembers = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { workspace } = await requireAdmin(ctx);
    if (workspace.isDemo) throw new ConvexError("The demo workspace isn't connected to Slack.");
    await ctx.scheduler.runAfter(0, internal.slack.syncAllMembers, { workspaceId: workspace._id });
    return null;
  },
});
