import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { allowanceCheck, ensureMember, remainingToday } from "./engine";
import { RARITY_SLACK_BADGE, type Rarity } from "./lib/messages";
import { DEFAULT_SETTINGS } from "./lib/settings";
import { siteUrl } from "./lib/slack";
import { addDays, dayKeyFor, weekdayOfKey } from "./lib/time";

/** Slack retries deliveries it thinks failed; claim each event id exactly once. */
export const claimEvent = internalMutation({
  args: { eventId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { eventId }) => {
    const seen = await ctx.db
      .query("slackEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
      .unique();
    if (seen) return false;
    await ctx.db.insert("slackEvents", { eventId });
    return true;
  },
});

export const pruneEvents = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const old = await ctx.db
      .query("slackEvents")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .take(500);
    for (const e of old) await ctx.db.delete(e._id);
    const states = await ctx.db
      .query("oauthStates")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .take(500);
    for (const s of states) await ctx.db.delete(s._id);
    // Keep going until the backlog is gone.
    if (old.length === 500 || states.length === 500) {
      await ctx.scheduler.runAfter(0, internal.slackData.pruneEvents, {});
    }
    return null;
  },
});

/**
 * Daily directory resync for every installed workspace: backstop for missed
 * user_change events (deactivations) and for installs that predate those subscriptions.
 */
export const scheduleDirectorySync = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const installs = await ctx.db.query("slackInstallations").take(1000);
    let i = 0;
    for (const install of installs) {
      const workspace = await ctx.db.get(install.workspaceId);
      if (!workspace || workspace.isDemo || workspace.status !== "active") continue;
      await ctx.scheduler.runAfter(i++ * 5_000, internal.slack.syncAllMembers, { workspaceId: workspace._id });
    }
    return null;
  },
});

const installationValidator = v.object({
  workspace: v.any(),
  botToken: v.string(),
  botUserId: v.string(),
});

export const workspaceForTeam = internalQuery({
  args: { teamId: v.string() },
  returns: v.union(v.null(), installationValidator),
  handler: async (ctx, { teamId }) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_team", (q) => q.eq("slackTeamId", teamId))
      .unique();
    if (!workspace || workspace.status !== "active" || workspace.isDemo) return null;
    const install = await ctx.db
      .query("slackInstallations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .unique();
    if (!install) return null;
    return { workspace, botToken: install.botToken, botUserId: install.botUserId };
  },
});

export const installationForWorkspace = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  returns: v.union(v.null(), installationValidator),
  handler: async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace || workspace.status !== "active" || workspace.isDemo) return null;
    const install = await ctx.db
      .query("slackInstallations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .unique();
    if (!install) return null;
    return { workspace, botToken: install.botToken, botUserId: install.botUserId };
  },
});

export const createOAuthState = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const state = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    await ctx.db.insert("oauthStates", { state, expiresAt: Date.now() + 10 * 60 * 1000 });
    return state;
  },
});

export const consumeOAuthState = internalMutation({
  args: { state: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { state }) => {
    const row = await ctx.db
      .query("oauthStates")
      .withIndex("by_state", (q) => q.eq("state", state))
      .unique();
    if (!row) return false;
    await ctx.db.delete(row._id);
    return row.expiresAt > Date.now();
  },
});

export const saveInstallation = internalMutation({
  args: {
    teamId: v.string(),
    teamName: v.string(),
    botToken: v.string(),
    botUserId: v.string(),
    appId: v.string(),
    installerSlackId: v.optional(v.string()),
    scope: v.string(),
  },
  returns: v.id("workspaces"),
  handler: async (ctx, args) => {
    let workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_team", (q) => q.eq("slackTeamId", args.teamId))
      .unique();
    const isFirstInstall = !workspace;
    if (!workspace) {
      const id = await ctx.db.insert("workspaces", {
        slackTeamId: args.teamId,
        name: args.teamName,
        isDemo: false,
        status: "active",
        ...DEFAULT_SETTINGS,
      });
      workspace = (await ctx.db.get(id))!;
    } else {
      await ctx.db.patch(workspace._id, { status: "active", name: args.teamName });
    }
    const existing = await ctx.db
      .query("slackInstallations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .unique();
    const install = {
      workspaceId: workspace._id,
      botToken: args.botToken,
      botUserId: args.botUserId,
      appId: args.appId,
      installedBySlackUserId: args.installerSlackId ?? "",
      scope: args.scope,
    };
    if (existing) await ctx.db.replace(existing._id, install);
    else await ctx.db.insert("slackInstallations", install);

    // Re-running OAuth must not be a way to become admin; Slack admins are promoted on member sync.
    if (isFirstInstall && args.installerSlackId) {
      const installer = await ensureMember(ctx, workspace, args.installerSlackId);
      await ctx.db.patch(installer._id, { isAdmin: true });
    }
    const bot = await ensureMember(ctx, workspace, args.botUserId);
    await ctx.db.patch(bot._id, { isBot: true, name: "Kudos" });
    return workspace._id;
  },
});

export const setWorkspaceIcon = internalMutation({
  args: { workspaceId: v.id("workspaces"), iconUrl: v.optional(v.string()), name: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { workspaceId, iconUrl, name }) => {
    await ctx.db.patch(workspaceId, { iconUrl, ...(name ? { name } : {}) });
    return null;
  },
});

const slackUserValidator = v.object({
  slackUserId: v.string(),
  name: v.string(),
  realName: v.optional(v.string()),
  title: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  isBot: v.boolean(),
  deactivated: v.boolean(),
  isSlackAdmin: v.boolean(),
});

export const upsertSlackUsers = internalMutation({
  args: { workspaceId: v.id("workspaces"), users: v.array(slackUserValidator) },
  returns: v.null(),
  handler: async (ctx, { workspaceId, users }) => {
    for (const u of users) {
      const existing = await ctx.db
        .query("members")
        .withIndex("by_workspace_slackUser", (q) =>
          q.eq("workspaceId", workspaceId).eq("slackUserId", u.slackUserId),
        )
        .unique();
      const profile = {
        name: u.name,
        realName: u.realName,
        title: u.title,
        avatarUrl: u.avatarUrl,
        isBot: u.isBot,
        deactivated: u.deactivated,
      };
      if (existing) {
        await ctx.db.patch(existing._id, profile);
      } else {
        await ctx.db.insert("members", {
          workspaceId,
          slackUserId: u.slackUserId,
          ...profile,
          isAdmin: u.isSlackAdmin,
          totalGiven: 0,
          totalReceived: 0,
          totalMaxedDays: 0,
        });
      }
    }
    return null;
  },
});

export const markUninstalled = internalMutation({
  args: { teamId: v.string() },
  returns: v.null(),
  handler: async (ctx, { teamId }) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_team", (q) => q.eq("slackTeamId", teamId))
      .unique();
    if (!workspace || workspace.isDemo) return null;
    await ctx.db.patch(workspace._id, { status: "uninstalled" });
    const install = await ctx.db
      .query("slackInstallations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .unique();
    if (install) await ctx.db.delete(install._id);
    return null;
  },
});

export const notificationsForDelivery = internalQuery({
  args: { ids: v.array(v.id("notifications")) },
  returns: v.array(
    v.object({
      _id: v.id("notifications"),
      slackUserId: v.string(),
      slackText: v.string(),
      rarity: v.string(),
      category: v.string(),
      isNewDiscovery: v.boolean(),
      discoveredCount: v.number(),
      delivery: v.string(),
    }),
  ),
  handler: async (ctx, { ids }) => {
    const out = [];
    for (const id of ids) {
      const n = await ctx.db.get(id);
      if (!n) continue;
      const member = await ctx.db.get(n.memberId);
      if (!member) continue;
      const discovered = await ctx.db
        .query("discoveries")
        .withIndex("by_member_template", (q) => q.eq("memberId", member._id))
        .take(500);
      out.push({
        _id: n._id,
        slackUserId: member.slackUserId,
        slackText: n.slackText,
        rarity: n.rarity,
        category: n.category,
        isNewDiscovery: n.isNewDiscovery,
        discoveredCount: discovered.length,
        delivery: n.delivery,
      });
    }
    return out;
  },
});

export const markDelivery = internalMutation({
  args: {
    id: v.id("notifications"),
    delivery: v.union(v.literal("sent"), v.literal("failed"), v.literal("skipped")),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { id, delivery, error }) => {
    await ctx.db.patch(id, { delivery, error });
    return null;
  },
});

async function weekStanding(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  workspace: Doc<"workspaces">,
  now: number,
) {
  const today = dayKeyFor(now, workspace.timezone);
  const start = addDays(today, -weekdayOfKey(today));
  const days = await ctx.db
    .query("memberDays")
    .withIndex("by_workspace_day", (q) =>
      q.eq("workspaceId", workspace._id).gte("dayKey", start).lte("dayKey", today),
    )
    .take(8000);
  const totals = new Map<Id<"members">, number>();
  for (const d of days) if (d.given > 0) totals.set(d.memberId, (totals.get(d.memberId) ?? 0) + d.given);
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

export const homeData = internalQuery({
  args: { workspaceId: v.id("workspaces"), slackUserId: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, { workspaceId, slackUserId }) => {
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) return null;
    const member = await ctx.db
      .query("members")
      .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspaceId).eq("slackUserId", slackUserId))
      .unique();
    const now = Date.now();
    const standing = await weekStanding(ctx, workspace, now);
    const top = [];
    for (const [memberId, given] of standing.slice(0, 5)) {
      const m = await ctx.db.get(memberId);
      if (m) top.push({ slackUserId: m.slackUserId, given });
    }
    const myIndex = member ? standing.findIndex(([id]) => id === member._id) : -1;
    const discovered = member
      ? (
          await ctx.db
            .query("discoveries")
            .withIndex("by_member_template", (q) => q.eq("memberId", member._id))
            .take(500)
        ).length
      : 0;
    return {
      emojiName: workspace.emojiName,
      dailyLimit: workspace.dailyLimit,
      showReceived: workspace.receivedVisibility !== "hidden",
      remaining: member ? await remainingToday(ctx, workspace, member._id, now) : workspace.dailyLimit,
      totalGiven: member?.totalGiven ?? 0,
      totalReceived: member?.totalReceived ?? 0,
      weekGiven: myIndex >= 0 ? standing[myIndex][1] : 0,
      weekRank: myIndex >= 0 ? myIndex + 1 : null,
      discovered,
      top,
    };
  },
});

/** `/kudos [me|top|help]` — returns an ephemeral Slack response body. */
export const slashCommand = internalMutation({
  args: { teamId: v.string(), slackUserId: v.string(), text: v.string() },
  returns: v.any(),
  handler: async (ctx, { teamId, slackUserId, text }) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_team", (q) => q.eq("slackTeamId", teamId))
      .unique();
    if (!workspace || workspace.status !== "active") {
      return { response_type: "ephemeral", text: "Kudos isn't installed in this workspace yet." };
    }
    const site = siteUrl();
    const e = `:${workspace.emojiName}:`;
    const sub = text.trim().toLowerCase();
    if (sub === "top" || sub === "leaderboard") {
      const standing = await weekStanding(ctx, workspace, Date.now());
      const lines = [];
      for (const [i, [memberId, given]] of standing.slice(0, 10).entries()) {
        const m = await ctx.db.get(memberId);
        if (m) lines.push(`${["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} <@${m.slackUserId}> · ${given} ${e}`);
      }
      return {
        response_type: "ephemeral",
        blocks: [
          { type: "header", text: { type: "plain_text", text: "This week's most generous" } },
          { type: "section", text: { type: "mrkdwn", text: lines.join("\n") || "_Nobody has given kudos this week yet. Be the first!_" } },
          { type: "context", elements: [{ type: "mrkdwn", text: `<${site}/leaderboard|Open the full leaderboard>` }] },
        ],
      };
    }
    if (sub === "" || sub === "me" || sub === "stats" || sub === "left") {
      const member = await ensureMember(ctx, workspace, slackUserId);
      const { notificationId, remaining } = await allowanceCheck(ctx, workspace, member, Date.now());
      // The slash command response *is* the delivery.
      await ctx.db.patch(notificationId, { delivery: "sent" });
      const n = (await ctx.db.get(notificationId))!;
      const fields = [
        `*Left today*\n${remaining} / ${workspace.dailyLimit} ${e}`,
        `*Given all-time*\n${member.totalGiven} ${e}`,
      ];
      if (workspace.receivedVisibility !== "hidden") fields.push(`*Received all-time*\n${member.totalReceived} ${e}`);
      return {
        response_type: "ephemeral",
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: n.slackText } },
          { type: "section", fields: fields.map((t) => ({ type: "mrkdwn", text: t })) },
          {
            type: "context",
            elements: [{ type: "mrkdwn", text: `${RARITY_SLACK_BADGE[n.rarity as Rarity]}${n.isNewDiscovery ? " · ✨ New discovery!" : ""} · <${site}/me|Your dashboard>` }],
          },
        ],
      };
    }
    return {
      response_type: "ephemeral",
      text: [
        `*How Kudos works* ${e}`,
        `• Mention teammates and add ${e} to your message: \`@ana @ben ${e}${e} thanks for the release!\``,
        `• Each ${e} gives one kudos to *every* person mentioned. You can give ${workspace.dailyLimit} per day.`,
        workspace.reactionsEnabled ? `• React with ${e} on a message to give its author one kudos.` : "",
        "• The bot answers with messages of different rarities. Collect them all!",
        "",
        "`/kudos me` your balance · `/kudos top` weekly leaderboard",
        `<${site}|Open the Kudos dashboard>`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  },
});

