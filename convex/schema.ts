import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { annotationsValidator, mentionValidator } from "./engine/messageEvent";
import { publicSectionValidator, shownValidator } from "./feedback/publicReplies";
import { segmentValidator } from "./feedback/replies";
import { effectsRecordValidator } from "./progression/progress";

export default defineSchema({
  slackReceipts: defineTable({
    workspace: v.string(),
    eventId: v.string(),
  }).index("by_event", ["workspace", "eventId"]),

  workspaces: defineTable({
    workspace: v.string(),
    baseAllowance: v.optional(v.number()),
    kudosEmoji: v.optional(v.string()),
    announcementChannel: v.optional(v.string()),
  }).index("by_workspace", ["workspace"]),

  members: defineTable({
    workspace: v.string(),
    user: v.string(),
    kind: v.union(v.literal("member"), v.literal("bot"), v.literal("not-a-member")),
    timeZone: v.optional(v.string()),
    asOf: v.optional(v.number()),
  }).index("by_user", ["workspace", "user"]),

  kudosMessages: defineTable({
    workspace: v.string(),
    conversation: v.string(),
    message: v.string(),
    threadRoot: v.optional(v.string()),
    author: v.string(),
    revision: v.int64(),
    state: v.union(
      v.literal("watermark"),
      v.literal("awaiting-directory"),
      v.literal("abandoned"),
      v.literal("given"),
      v.literal("over-allowance"),
      v.literal("invalid"),
      v.literal("withdrawn"),
    ),
    attempt: v.int64(),
    content: v.object({ mentions: v.array(mentionValidator), emoji: v.array(v.string()) }),
    annotations: annotationsValidator,
    spendsAt: v.number(),
    checks: v.number(),
  }).index("by_message", ["workspace", "conversation", "message"]),

  awards: defineTable({
    workspace: v.string(),
    conversation: v.string(),
    message: v.string(),
    giver: v.id("members"),
    recipient: v.id("members"),
    kudos: v.number(),
    day: v.string(),
    at: v.number(),
  })
    .index("by_giver", ["giver", "day"])
    .index("by_recipient", ["recipient", "day"]),

  kudosTotals: defineTable({
    member: v.id("members"),
    given: v.number(),
    received: v.number(),
  }).index("by_member", ["member"]),

  allowanceSpending: defineTable({
    giver: v.id("members"),
    day: v.string(),
    spent: v.number(),
  }).index("by_giver_day", ["giver", "day"]),

  welcomes: defineTable({
    member: v.id("members"),
  }).index("by_member", ["member"]),

  indicators: defineTable({
    workspace: v.string(),
    conversation: v.string(),
    message: v.string(),
    emoji: v.union(v.string(), v.null()),
    version: v.number(),
  }).index("by_message", ["workspace", "conversation", "message"]),

  privateReplies: defineTable({
    workspace: v.string(),
    conversation: v.string(),
    message: v.string(),
    threadRoot: v.optional(v.string()),
    to: v.string(),
    lines: v.array(v.array(segmentValidator)),
  }),

  publicReplies: defineTable({
    workspace: v.string(),
    conversation: v.string(),
    message: v.string(),
    channel: v.string(),
    threadTs: v.optional(v.string()),
    sections: v.array(publicSectionValidator),
    version: v.number(),
    shown: shownValidator,
  }).index("by_destination", ["workspace", "conversation", "message", "channel", "threadTs"]),

  placedReactions: defineTable({
    workspace: v.string(),
    conversation: v.string(),
    message: v.string(),
    emoji: v.array(v.string()),
  }).index("by_message", ["workspace", "conversation", "message"]),

  effectsRecords: defineTable(effectsRecordValidator).index("by_award", ["award", "side"]),

  memberProgress: defineTable({
    member: v.id("members"),
    xp: v.number(),
    pointsSpent: v.number(),
  }).index("by_member", ["member"]),

  progressSettings: defineTable({
    member: v.id("members"),
    dms: v.optional(v.boolean()),
    hideLevel: v.optional(v.boolean()),
    muteNotices: v.optional(v.boolean()),
  }).index("by_member", ["member"]),

  slackRateLimits: defineTable({
    workspace: v.string(),
    method: v.string(),
    until: v.number(),
  }).index("by_method", ["workspace", "method"]),
});
