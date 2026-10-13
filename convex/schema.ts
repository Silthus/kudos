import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { exceptionValidator } from "./analytics/exceptions";
import { propertiesValidator } from "./analytics/projections";
import { annotationsValidator, mentionValidator } from "./engine/messageEvent";
import { homeTabValidator } from "./feedback/homes";
import { publicSectionValidator, shownValidator } from "./feedback/publicReplies";
import { segmentValidator } from "./feedback/replies";
import { periodValidator } from "./leaderboard/periods";
import { effectsRecordValidator } from "./progression/progress";
import { rewardRecordValidator } from "./progression/rewards";
import { crateOpeningValidator } from "./quests/crates";
import { journeyActivationValidator } from "./quests/journey";
import { featureValidator } from "./unlocks/feature";

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
    name: v.optional(v.string()),
    timeZone: v.optional(v.string()),
    admin: v.optional(v.boolean()),
    asOf: v.optional(v.number()),
  })
    .index("by_user", ["workspace", "user"])
    .index("by_admin", ["workspace", "admin"]),

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
    retry: v.optional(v.boolean()),
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
    .index("by_recipient", ["recipient", "day"])
    .index("by_message", ["workspace", "conversation", "message"]),

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

  rewardRecords: defineTable(rewardRecordValidator).index("by_member_key", ["member", "key"]),

  journeySteps: defineTable(journeyActivationValidator).index("by_member_step", ["member", "step"]),

  crateOpenings: defineTable(crateOpeningValidator).index("by_member_key", ["member", "key"]),

  effectsBackfill: defineTable({
    before: v.number(),
    cursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),

  memberProgress: defineTable({
    member: v.id("members"),
    xp: v.number(),
    pointsSpent: v.number(),
  }).index("by_member", ["member"]),

  progressSettings: defineTable({
    member: v.id("members"),
    dms: v.optional(v.boolean()),
    muteNotices: v.optional(v.boolean()),
  }).index("by_member", ["member"]),

  unlocks: defineTable({
    member: v.id("members"),
    feature: featureValidator,
    readyAt: v.number(),
    openedAt: v.optional(v.number()),
  }).index("by_member_feature", ["member", "feature"]),

  unlockLaunches: defineTable({
    workspace: v.string(),
    at: v.number(),
    shipped: v.array(featureValidator),
  }).index("by_workspace", ["workspace"]),

  levelUps: defineTable({
    member: v.id("members"),
    level: v.number(),
    ready: v.array(featureValidator),
    at: v.number(),
  }).index("by_member_level", ["member", "level"]),

  homes: defineTable({
    member: v.id("members"),
    tab: v.union(v.literal("profile"), v.literal("settings"), v.literal("admin")),
    version: v.number(),
  }).index("by_member", ["member"]),

  countedKudosGiven: defineTable({
    workspace: v.string(),
    conversation: v.string(),
    message: v.string(),
  }).index("by_message", ["workspace", "conversation", "message"]),

  givenByDay: defineTable({
    workspace: v.string(),
    member: v.id("members"),
    day: v.string(),
    kudos: v.number(),
  })
    .index("by_member_day", ["member", "day"])
    .index("by_workspace_day", ["workspace", "day"]),

  givenTotals: defineTable({
    workspace: v.string(),
    member: v.id("members"),
    period: v.string(),
    kudos: v.number(),
  })
    .index("by_period", ["workspace", "period"])
    .index("by_member_period", ["member", "period"]),

  leaderboardSettings: defineTable({
    member: v.id("members"),
    visible: v.boolean(),
  }).index("by_member", ["member"]),

  homeSelections: defineTable({
    member: v.id("members"),
    tab: homeTabValidator,
    period: periodValidator,
  }).index("by_member", ["member"]),

  slackRateLimits: defineTable({
    workspace: v.string(),
    method: v.string(),
    until: v.number(),
  }).index("by_method", ["workspace", "method"]),

  analyticsIds: defineTable({
    member: v.id("members"),
    analyticsId: v.string(),
  }).index("by_member", ["member"]),

  workspaceKeys: defineTable({
    workspace: v.string(),
    workspaceKey: v.string(),
  }).index("by_workspace", ["workspace"]),

  analyticsOutbox: defineTable({
    uuid: v.string(),
    event: v.string(),
    distinctId: v.string(),
    timestamp: v.number(),
    properties: propertiesValidator,
    exception: v.optional(exceptionValidator),
    state: v.union(v.literal("pending"), v.literal("sending"), v.literal("exhausted")),
    failures: v.number(),
    dueAt: v.number(),
    lease: v.optional(v.string()),
    reason: v.optional(v.union(v.literal("rejected"), v.literal("exhausted"), v.literal("expired"))),
  })
    .index("by_state", ["state"])
    .index("by_due", ["state", "dueAt"]),

  analyticsDrain: defineTable({
    job: v.id("_scheduled_functions"),
    generation: v.string(),
  }),

  errorSweep: defineTable({
    cursor: v.number(),
    watchCursor: v.number(),
  }),

  watchedJobs: defineTable({
    job: v.id("_scheduled_functions"),
  }).index("by_job", ["job"]),

  reportedJobs: defineTable({
    job: v.id("_scheduled_functions"),
  }).index("by_job", ["job"]),

  flagExposures: defineTable({
    member: v.id("members"),
    flag: v.string(),
    value: v.union(v.string(), v.boolean()),
  }).index("by_member_flag_value", ["member", "flag", "value"]),
});
