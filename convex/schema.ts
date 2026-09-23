import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export const rarityValidator = v.union(
  v.literal("common"),
  v.literal("uncommon"),
  v.literal("rare"),
  v.literal("epic"),
  v.literal("legendary"),
);

export const categoryValidator = v.union(
  v.literal("giver_success"),
  v.literal("receiver_success"),
  v.literal("limit_reached"),
  v.literal("allowance_status"),
  v.literal("self_kudos"),
);

export const receivedVisibilityValidator = v.union(
  v.literal("hidden"), // nobody sees received counts (giving-first culture)
  v.literal("self"), // you see your own received counts
  v.literal("everyone"), // received counts show up on leaderboards too
);

export const kudosSourceValidator = v.union(
  v.literal("message"),
  v.literal("reaction"),
  v.literal("playground"),
  v.literal("seed"),
);

export const settingsFields = {
  emojiName: v.string(), // Slack shortcode without colons, e.g. "taco"
  emojiGlyph: v.string(), // What the web app renders, e.g. "🌮"
  unitSingular: v.string(),
  unitPlural: v.string(),
  dailyLimit: v.number(),
  timezone: v.string(),
  receivedVisibility: receivedVisibilityValidator,
  reactionsEnabled: v.boolean(),
  notifyGiver: v.boolean(),
  notifyReceiver: v.boolean(),
};

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    slackUserId: v.optional(v.string()),
    slackTeamId: v.optional(v.string()),
    isDemo: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  workspaces: defineTable({
    slackTeamId: v.string(),
    name: v.string(),
    iconUrl: v.optional(v.string()),
    isDemo: v.boolean(),
    status: v.union(v.literal("active"), v.literal("uninstalled")),
    resettingSince: v.optional(v.number()), // demo only: a reset is in progress
    ...settingsFields,
  }).index("by_team", ["slackTeamId"]),

  // Secrets live apart from `workspaces` so no public query can leak them by accident.
  slackInstallations: defineTable({
    workspaceId: v.id("workspaces"),
    botToken: v.string(),
    botUserId: v.string(),
    appId: v.string(),
    installedBySlackUserId: v.string(),
    scope: v.string(),
  }).index("by_workspace", ["workspaceId"]),

  members: defineTable({
    workspaceId: v.id("workspaces"),
    slackUserId: v.string(),
    name: v.string(),
    realName: v.optional(v.string()),
    title: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    isAdmin: v.boolean(),
    isBot: v.boolean(),
    deactivated: v.boolean(),
    userId: v.optional(v.id("users")),
    totalGiven: v.number(),
    totalReceived: v.number(),
    totalMaxedDays: v.number(),
    lastGivenAt: v.optional(v.number()),
  })
    .index("by_workspace_slackUser", ["workspaceId", "slackUserId"])
    .index("by_workspace_totalGiven", ["workspaceId", "totalGiven"])
    .index("by_user", ["userId"]),

  kudos: defineTable({
    workspaceId: v.id("workspaces"),
    batchId: v.string(), // one Slack message → one batch, one row per recipient
    giverId: v.id("members"),
    receiverId: v.id("members"),
    amount: v.number(),
    dayKey: v.string(), // YYYY-MM-DD in the workspace timezone
    source: kudosSourceValidator,
    channelId: v.string(),
    channelName: v.optional(v.string()),
    channelPrivate: v.optional(v.boolean()), // private channel: name stays out of workspace-wide views
    messageTs: v.optional(v.string()),
    text: v.string(),
    at: v.number(), // when it was given (seeded demo history is back-dated)
  })
    .index("by_workspace_at", ["workspaceId", "at"])
    .index("by_giver_at", ["giverId", "at"])
    .index("by_receiver_at", ["receiverId", "at"])
    .index("by_batch", ["batchId"])
    .index("by_message", ["workspaceId", "channelId", "messageTs"])
    .index("by_message_giver_source", ["workspaceId", "channelId", "messageTs", "giverId", "source"]),

  // Per-member daily rollup: powers allowances, leaderboards, streaks and cadence charts.
  memberDays: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    dayKey: v.string(),
    given: v.number(),
    received: v.number(),
    maxed: v.boolean(),
  })
    .index("by_member_day", ["memberId", "dayKey"])
    .index("by_workspace_day", ["workspaceId", "dayKey"]),

  discoveries: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    templateKey: v.string(),
    rarity: rarityValidator,
    category: categoryValidator,
    timesSeen: v.number(),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_member_template", ["memberId", "templateKey"])
    .index("by_member_lastSeen", ["memberId", "lastSeenAt"])
    .index("by_workspace_firstSeen", ["workspaceId", "firstSeenAt"]),

  // Every message the bot sends (or would send, in the demo workspace).
  notifications: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    category: categoryValidator,
    templateKey: v.string(),
    rarity: rarityValidator,
    isNewDiscovery: v.boolean(),
    slackText: v.string(),
    webText: v.string(),
    delivery: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("skipped"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
  }).index("by_member", ["memberId"]),

  slackEvents: defineTable({
    eventId: v.string(),
  }).index("by_eventId", ["eventId"]),

  oauthStates: defineTable({
    state: v.string(),
    expiresAt: v.number(),
  }).index("by_state", ["state"]),
});
