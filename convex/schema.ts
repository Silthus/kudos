import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { ladderValidator } from "./achievements/ladders";
import { messageKindValidator, messagePlaceValidator } from "./messageSettings/kinds";
import { bookReplayCursorValidator, bookReplayValidator } from "./achievements/replay";
import { earnedTierValidator } from "./achievements/tiers";
import { exceptionValidator } from "./analytics/exceptions";
import { awardIdValidator } from "./engine/awards";
import { personPropertiesValidator, propertiesValidator } from "./analytics/projections";
import { kudosTextValidator } from "./engine/kudosText";
import { annotationsValidator, mentionValidator, messageRefValidator } from "./engine/messageEvent";
import { homeTabValidator } from "./feedback/homes";
import { attributedAwardValidator, groupOrNoneValidator } from "./groups/attributedAward";
import { primaryGroupCauseValidator } from "./groups/cause";
import { groupModeValidator } from "./groups/mode";
import { publicReplyValidator } from "./feedback/publicReplies";
import { tierNoticeValidator, tierSummaryValidator } from "./feedback/tierNotices";
import { gainsValidator } from "./feedback/replies";
import { segmentValidator } from "./feedback/segments";
import { mondayPostOutcomeValidator } from "./leaderboard/mondayPostOutcome";
import { periodValidator } from "./leaderboard/periods";
import { purchaseOutcomeValidator } from "./progression/purchases";
import { effectsRecordValidator } from "./progression/progress";
import { rewardRecordValidator } from "./progression/rewards";
import { perkValidator } from "./progression/tree";
import { boughtCrateValidator, dropTallyValidator, dropValidator, hoggieTallyValidator } from "./hoggies/records";
import { crateOpeningValidator, pendingCrateValidator } from "./quests/crates";
import { groupFeasibleBecauseValidator, groupQuestIdValidator } from "./quests/groupPool";
import { journeyActivationValidator, rewardValidator } from "./quests/journey";
import { questDrawValidator, questProgressValidator, questSwapValidator } from "./quests/weekly";
import { collectedItemValidator, customKudosEmojiValidator, itemPurchaseValidator, loadoutSlotValidator } from "./store/rows";
import { featureValidator } from "./unlocks/feature";
import { welcomedAsValidator } from "./welcome/welcomedAs";
import { memberProfileFields } from "./workspace/memberProfile";
import { coinSpendValidator } from "./wallet/wallet";

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    givenName: v.optional(v.string()),
    familyName: v.optional(v.string()),
    image: v.optional(v.string()),
    chatIdentity: v.optional(v.object({ workspace: v.string(), user: v.string() })),
  }),

  memberVerifications: defineTable({
    workspace: v.string(),
    user: v.string(),
    attempts: v.number(),
    state: v.union(v.literal("pending"), v.literal("failed")),
    nextTryAt: v.optional(v.number()),
  })
    .index("by_user", ["workspace", "user"])
    .index("by_state_and_next_try", ["state", "nextTryAt"]),

  websiteClock: defineTable({
    tick: v.number(),
  }),

  companyProfiles: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    normalisedName: v.string(),
    image: v.optional(v.string()),
    colour: v.string(),
    team: v.optional(v.string()),
  }).index("by_normalised_name", ["normalisedName"]),

  slackReceipts: defineTable({
    workspace: v.string(),
    eventId: v.string(),
  }).index("by_event", ["workspace", "eventId"]),

  workspaces: defineTable({
    workspace: v.string(),
    baseAllowance: v.optional(v.number()),
    kudosEmoji: v.optional(v.string()),
    announcementChannel: v.optional(v.string()),
    url: v.optional(v.string()),
    urlRequestedAt: v.optional(v.number()),
  }).index("by_workspace", ["workspace"]),

  members: defineTable({
    workspace: v.string(),
    user: v.string(),
    kind: v.union(v.literal("member"), v.literal("bot"), v.literal("not-a-member")),
    name: v.optional(v.string()),
    timeZone: v.optional(v.string()),
    admin: v.optional(v.boolean()),
    ...memberProfileFields,
    asOf: v.optional(v.number()),
    profileAsOf: v.optional(v.number()),
  })
    .index("by_user", ["workspace", "user"])
    .index("by_admin", ["workspace", "admin"]),

  userGroups: defineTable({
    workspace: v.string(),
    group: v.string(),
    handle: v.string(),
    name: v.string(),
    enabled: v.boolean(),
    automatic: v.boolean(),
    members: v.optional(v.number()),
    membersCountAsOf: v.optional(v.number()),
    asOf: v.number(),
    membersAsOf: v.optional(v.number()),
    changedAt: v.optional(v.number()),
    allowlistChangedAt: v.optional(v.number()),
  }).index("by_group", ["workspace", "group"]),

  userGroupMembers: defineTable({
    workspace: v.string(),
    group: v.string(),
    user: v.string(),
  })
    .index("by_group", ["workspace", "group", "user"])
    .index("by_user", ["workspace", "user"]),

  memberGroups: defineTable({
    workspace: v.string(),
    member: v.id("members"),
    groups: v.array(v.id("userGroups")),
    primary: v.union(v.id("userGroups"), v.null()),
  })
    .index("by_member", ["member"])
    .index("by_primary", ["primary"]),

  groupSettings: defineTable({
    workspace: v.string(),
    mode: groupModeValidator,
    allowlist: v.optional(v.array(v.id("userGroups"))),
  }).index("by_workspace", ["workspace"]),

  primaryGroupHistory: defineTable({
    workspace: v.string(),
    member: v.id("members"),
    from: v.union(v.id("userGroups"), v.null()),
    group: v.union(v.id("userGroups"), v.null()),
    cause: primaryGroupCauseValidator,
    at: v.number(),
  }).index("by_member_at", ["member", "at"]),

  attributions: defineTable({
    workspace: v.string(),
    conversation: v.string(),
    message: v.string(),
    giver: v.id("members"),
    group: groupOrNoneValidator,
    kudos: v.number(),
    day: v.string(),
    at: v.number(),
    awards: v.array(attributedAwardValidator),
  })
    .index("by_message", ["workspace", "conversation", "message"])
    .index("by_group_at", ["group", "at"]),

  customEmoji: defineTable({
    workspace: v.string(),
    name: v.string(),
    image: v.string(),
    aliasOf: v.optional(v.string()),
    listing: v.number(),
  })
    .index("by_name", ["workspace", "name"])
    .index("by_listing", ["workspace", "listing"]),

  customEmojiListings: defineTable({
    workspace: v.string(),
    begun: v.number(),
    written: v.optional(v.number()),
    refreshDueAt: v.optional(v.number()),
    scopeMissing: v.optional(v.boolean()),
  }).index("by_workspace", ["workspace"]),

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
    nextCheckAt: v.optional(v.number()),
  })
    .index("by_message", ["workspace", "conversation", "message"])
    .index("by_state_and_next_check", ["state", "nextCheckAt"]),

  kudosTexts: defineTable(kudosTextValidator).index("by_message", ["workspace", "conversation", "message"]).index("by_author", ["workspace", "author"]),
  wordDeletionRequests: defineTable({ workspace: v.string(), author: v.union(v.string(), v.null()) }).index("by_author", ["workspace", "author"]),

  spotlightDraws: defineTable({ ...messageRefValidator.fields, position: v.number() })
    .index("by_position", ["workspace", "position"])
    .index("by_message", ["workspace", "conversation", "message"]),

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
    .index("by_giver_recipient", ["giver", "recipient"])
    .index("by_recipient", ["recipient", "day"])
    .index("by_recipient_at", ["recipient", "at"])
    .index("by_giver_at", ["giver", "at"])
    .index("by_message", ["workspace", "conversation", "message"])
    .index("by_workspace", ["workspace"]),

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
    welcomed: v.optional(welcomedAsValidator),
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
    given: v.optional(v.array(segmentValidator)),
    lines: v.array(v.array(segmentValidator)),
    questsDone: v.optional(v.array(segmentValidator)),
    hint: v.optional(v.array(segmentValidator)),
    gains: v.optional(gainsValidator),
    held: v.optional(v.literal(true)),
  }).index("by_held_message", ["workspace", "conversation", "message", "held"]),

  publicReplies: defineTable(publicReplyValidator)
    .index("by_destination", ["workspace", "conversation", "message", "channel", "threadTs"])
    .index("by_level_reached", ["reached.member", "reached.level"]),

  placedReactions: defineTable({
    workspace: v.string(),
    conversation: v.string(),
    message: v.string(),
    emoji: v.array(v.string()),
  }).index("by_message", ["workspace", "conversation", "message"]),

  effectsRecords: defineTable(effectsRecordValidator).index("by_award", ["award", "side"]).index("by_member_side", ["member", "side"]),

  rewardRecords: defineTable(rewardRecordValidator)
    .index("by_member_key", ["member", "key"])
    .index("by_member_cause", ["member", "cause.workspace", "cause.conversation", "cause.message"]),

  receivingGivers: defineTable({
    recipient: v.id("members"),
    week: v.string(),
    giver: v.id("members"),
  }).index("by_recipient_week", ["recipient", "week"]),

  wallets: defineTable({
    member: v.id("members"),
    balance: v.number(),
  }).index("by_member", ["member"]),

  coinSpends: defineTable(coinSpendValidator).index("by_member", ["member"]),

  collection: defineTable(collectedItemValidator).index("by_member_item", ["member", "item"]),

  loadouts: defineTable(loadoutSlotValidator).index("by_member_slot", ["member", "slot"]),

  itemPurchases: defineTable(itemPurchaseValidator).index("by_member_key", ["member", "key"]),

  customKudosEmoji: defineTable(customKudosEmojiValidator).index("by_workspace_name", ["workspace", "name"]),

  journeySteps: defineTable(journeyActivationValidator).index("by_member_step", ["member", "step"]),

  journeyLaunches: defineTable({
    workspace: v.string(),
    at: v.number(),
  }).index("by_workspace", ["workspace"]),

  bookLaunches: defineTable({
    workspace: v.string(),
    at: v.number(),
  }).index("by_workspace", ["workspace"]),

  ladderCounts: defineTable({
    member: v.id("members"),
    ladder: ladderValidator,
    count: v.number(),
  }).index("by_member_ladder", ["member", "ladder"]),

  ladderMarks: defineTable({
    member: v.id("members"),
    ladder: ladderValidator,
    group: v.string(),
    key: v.string(),
  }).index("by_member_ladder_group", ["member", "ladder", "group"]),

  countedAwards: defineTable({
    award: awardIdValidator,
    member: v.id("members"),
    ladder: ladderValidator,
    count: v.number(),
    at: v.number(),
  })
    .index("by_award_member_ladder", ["award", "member", "ladder"])
    .index("by_member_ladder_count", ["member", "ladder", "count"]),

  bookBatches: defineTable({
    workspace: v.string(),
    at: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_workspace", ["workspace"]),

  bookReplays: defineTable(bookReplayValidator).index("by_workspace_ladder", ["workspace", "ladder"]).index("by_batch", ["batch"]),

  bookReplayCursors: defineTable(bookReplayCursorValidator).index("by_replay", ["replay"]),

  earnedTiers: defineTable(earnedTierValidator).index("by_member_ladder_tier", ["member", "ladder", "tier"]),

  tierNotices: defineTable(tierNoticeValidator).index("by_member_message", ["member", "workspace", "conversation", "message"]),

  tierSummaries: defineTable(tierSummaryValidator).index("by_member", ["member"]),

  questDraws: defineTable(questDrawValidator).index("by_member_week", ["member", "week"]),

  questSwaps: defineTable(questSwapValidator).index("by_member_week", ["member", "week"]),

  questProgress: defineTable(questProgressValidator).index("by_member_week_slot", ["member", "week", "slot"]),

  groupQuestLaunches: defineTable({ workspace: v.string(), at: v.number() }).index("by_workspace", ["workspace"]),

  groupQuestWeeks: defineTable({ workspace: v.string(), week: v.string(), drawnAt: v.number() }).index("by_workspace_week", ["workspace", "week"]),

  groupQuests: defineTable({
    workspace: v.string(),
    group: v.id("userGroups"),
    week: v.string(),
    quest: groupQuestIdValidator,
    participants: v.array(v.id("members")),
    target: v.number(),
    reward: rewardValidator,
    catalogueVersion: v.string(),
    feasibleBecause: groupFeasibleBecauseValidator,
    drawnAt: v.number(),
  }).index("by_group_week", ["group", "week"]),

  groupQuestContributions: defineTable({
    workspace: v.string(),
    group: v.id("userGroups"),
    week: v.string(),
    member: v.id("members"),
    message: messageRefValidator,
    at: v.number(),
  }).index("by_group_week_member", ["group", "week", "member"]),

  crateOpenings: defineTable(crateOpeningValidator).index("by_member_key", ["member", "key"]),

  pendingCrates: defineTable(pendingCrateValidator).index("by_member_key", ["member", "key"]),

  drops: defineTable(dropValidator).index("by_member_crate", ["member", "crate"]).index("by_member_at", ["member", "at", "n"]),

  hoggieTallies: defineTable(hoggieTallyValidator).index("by_member_hoggie", ["member", "hoggie"]),

  dropTallies: defineTable(dropTallyValidator).index("by_member", ["member"]),

  boughtCrates: defineTable(boughtCrateValidator).index("by_member_crate", ["member", "crate"]).index("by_member_n", ["member", "n"]).index("by_member_opened", ["member", "openedAt", "n"]),

  pendingCratesBackfill: defineTable({
    cursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),

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

  perksOwned: defineTable({
    member: v.id("members"),
    perk: perkValidator,
    boughtAt: v.number(),
    catalogueVersion: v.string(),
  }).index("by_member_perk", ["member", "perk"]),

  perkPurchases: defineTable({
    member: v.id("members"),
    key: v.string(),
    outcome: purchaseOutcomeValidator,
  }).index("by_member_key", ["member", "key"]),

  progressSettings: defineTable({
    member: v.id("members"),
    dms: v.optional(v.boolean()),
    muteNotices: v.optional(v.boolean()),
  }).index("by_member", ["member"]),

  messageSettings: defineTable({
    member: v.id("members"),
    kind: messageKindValidator,
    on: v.boolean(),
    place: v.optional(messagePlaceValidator),
  }).index("by_member_kind", ["member", "kind"]),

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

  previewMoments: defineTable({
    member: v.id("members"),
    moment: v.union(v.literal("unlocks"), v.literal("journey")),
    at: v.number(),
  }).index("by_member_moment", ["member", "moment"]),

  levelUps: defineTable({
    member: v.id("members"),
    level: v.number(),
    ready: v.array(featureValidator),
    at: v.number(),
  })
    .index("by_member_level", ["member", "level"])
    .index("by_member_at", ["member", "at"]),

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

  attributedTotals: defineTable({
    workspace: v.string(),
    group: v.id("userGroups"),
    member: v.id("members"),
    period: v.string(),
    kudos: v.number(),
    runningTotal: v.optional(v.array(v.number())),
  })
    .index("by_group_period", ["group", "period"])
    .index("by_member_group_period", ["member", "group", "period"]),

  attributedGroupTotals: defineTable({
    workspace: v.string(),
    group: v.id("userGroups"),
    period: v.string(),
    kudos: v.number(),
    runningTotal: v.optional(v.array(v.number())),
  }).index("by_group_period", ["group", "period"]),

  countedAttributions: defineTable({
    workspace: v.string(),
    conversation: v.string(),
    message: v.string(),
  }).index("by_message", ["workspace", "conversation", "message"]),

  givenTotals: defineTable({
    workspace: v.string(),
    member: v.id("members"),
    period: v.string(),
    kudos: v.number(),
    runningTotal: v.optional(v.array(v.number())),
  })
    .index("by_period", ["workspace", "period"])
    .index("by_member_period", ["member", "period"]),

  mondayPostSettings: defineTable({
    workspace: v.string(),
    on: v.boolean(),
    timeZone: v.string(),
    generation: v.number(),
    nextPostAt: v.optional(v.number()),
  }).index("by_workspace", ["workspace"]),

  mondayPostClaims: defineTable({
    workspace: v.string(),
    week: v.string(),
    claimedAt: v.number(),
    channel: v.string(),
    outcome: mondayPostOutcomeValidator,
  }).index("by_workspace_week", ["workspace", "week"]),

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
    profileFingerprint: v.optional(v.union(v.string(), v.null())),
    profileUncertain: v.optional(v.boolean()),
  })
    .index("by_member", ["member"])
    .index("by_analytics_id", ["analyticsId"])
    .index("by_profile_fingerprint", ["profileFingerprint"]),

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
    person: v.optional(v.object({ set: personPropertiesValidator, unset: v.array(v.string()), fingerprint: v.string() })),
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
