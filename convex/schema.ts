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

export const redemptionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("fulfilled"),
  v.literal("declined"),
  v.literal("cancelled"),
);

/** Who changed a balance: an admin by hand, or an automation such as quest rewards. */
export const adjustmentSourceValidator = v.union(v.literal("admin"), v.literal("system"));

export const rarityCountsValidator = v.object({
  common: v.number(),
  uncommon: v.number(),
  rare: v.number(),
  epic: v.number(),
  legendary: v.number(),
});

export const categoryValidator = v.union(
  v.literal("giver_success"),
  v.literal("receiver_success"),
  v.literal("limit_reached"),
  v.literal("allowance_status"),
  v.literal("self_kudos"),
  v.literal("quest_complete"), // Quest messages: only ever earned by completing a quest
);

/**
 * What a notification is about: a rarity-rolled message category, or a game gain DM that isn't
 * rolled (`level_up`). Only rolled categories become discoveries.
 */
export const notificationCategoryValidator = v.union(categoryValidator, v.literal("level_up"));

export const xpItemKindValidator = v.union(
  v.literal("base"),
  v.literal("new_connection"),
  v.literal("story"),
  v.literal("rekindle"),
  v.literal("unsung"),
  v.literal("thin"),
);

/** What a kudos earned its giver, itemised for the earnings reply (lib/xp.ts `earningsText`). */
export const earningsValidator = v.object({
  xp: v.number(), // after the daily cap
  coins: v.optional(v.number()), // Hog coins it earned; only once the giver's wallet is open (level 3)
  bonuses: v.array(v.object({ kind: xpItemKindValidator, xp: v.number() })), // everything but base/thin, before the cap
  capped: v.boolean(), // the daily cap cut something
  noReason: v.boolean(), // some recipient got a kudos without a reason
  thankBack: v.boolean(), // some recipient was thanked back within 72 h
});

export const questProgressValidator = v.object({
  completed: v.number(), // done quests on the week's board
  available: v.number(), // quests on the board that aren't waived
  sweep: v.boolean(), // this completion cleared the board
});

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

/** How a kudos attempt (a message carrying the kudos emoji) ended. */
export const attemptOutcomeValidator = v.union(v.literal("given"), v.literal("limit"), v.literal("invalid"));

/** Why an attempt gave nothing even though the allowance would have covered it. */
export const invalidReasonValidator = v.union(
  v.literal("no_mention"), // nobody mentioned
  v.literal("group"), // only group mentions (@here, @channel, user groups)
  v.literal("self"), // only yourself
  v.literal("bots"), // only bots or the Kudos app
  v.literal("inactive"), // only deactivated or unknown people (possibly alongside bots)
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
  questsEnabled: v.optional(v.boolean()), // weekly quests; undefined = on (installed before the switch)
  gameEnabled: v.optional(v.boolean()), // the game (XP, levels, ...); undefined = off, on in the demo
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
    storeEnabled: v.optional(v.boolean()), // Rewards Store; undefined = off
    // When weekly quests were switched off (`until`: back on), oldest first; the last year's only
    // (quests.ts `switchQuests`). Kudos given meanwhile are history but never quest steps.
    questsPauses: v.optional(v.array(v.object({ from: v.number(), until: v.optional(v.number()) }))),
    // When the game was switched off after being on (`until`: back on), oldest first (game.ts
    // `switchGame`). Kudos given meanwhile never earn anything, not even in a rebuild. Before the
    // game was first switched on nothing is paused: switching it on plays the history through.
    gamePauses: v.optional(v.array(v.object({ from: v.number(), until: v.optional(v.number()) }))),
    // Mirrors the `all` workspaceStats row's `rollupsBackfilledAt` (lib/rebuild.ts markBackfilled).
    // Queries that must not re-run on every give in the workspace (me.overview) gate on this copy:
    // the `all` row changes with every give, this document almost never does.
    rollupsBackfilledAt: v.optional(v.number()),
    // When a full rebuild last recomputed `successStats` (lib/rebuild.ts markBackfilled). Rollups
    // backfilled before that table existed carry `rollupsBackfilledAt` without it, so the success
    // metrics wait for their own marker instead of showing a history of zeros.
    successBackfilledAt: v.optional(v.number()),
    // "YYYY-MM": the month the game was first switched on. The success metrics' baseline is the
    // three months before it (analytics.ts `anchorSuccessBaseline`); unset, it rolls with today.
    successBaselineBefore: v.optional(v.string()),
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
    // When the signed-in user last chose this workspace (Slack sign-in or the switcher); a user
    // linked to several members sees the latest one (see `memberships` in lib/access.ts).
    activeAt: v.optional(v.number()),
    totalGiven: v.number(),
    totalReceived: v.number(),
    totalMaxedDays: v.number(),
    lastGivenAt: v.optional(v.number()),
    // Giving profile, maintained with every give/revoke (see lib/rollups.ts). Absent until the
    // member first gives after rollups shipped; the first maintenance recomputes it from memberDays.
    currentStreak: v.optional(v.number()), // consecutive giving days ending at lastActiveDay
    longestStreak: v.optional(v.number()),
    lastActiveDay: v.optional(v.string()), // latest dayKey with given > 0
    givenByWeekday: v.optional(v.array(v.number())), // 7 sums, Monday first
    storeSpent: v.optional(v.number()), // Σ cost of non-refunded redemptions; undefined = 0
    storeGranted: v.optional(v.number()), // Σ balance adjustments; undefined = 0
    coinsSpent: v.optional(v.number()), // Hog coins spent (the Store, #91); undefined = 0
    coinsAdjusted: v.optional(v.number()), // Σ ± admin adjustments of Hog coins (#91); undefined = 0
    gameHidden: v.optional(v.boolean()), // "Hide the game": no game UI or DMs for them; XP keeps accruing
    adminRemovedBy: v.optional(v.id("members")), // who last removed this member's admin role (four-eyes rule)
  })
    .index("by_workspace_slackUser", ["workspaceId", "slackUserId"])
    .index("by_workspace_totalGiven", ["workspaceId", "totalGiven"])
    .index("by_workspace_isAdmin", ["workspaceId", "isAdmin"]) // the Store's four-eyes rule
    .index("by_adminRemovedBy", ["adminRemovedBy"]) // …and the admins someone demoted
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
    hour: v.optional(v.number()), // local hour (0–23) at write time; keeps heatmap buckets stable
    noteWords: v.optional(v.number()), // words in the Note (lib/parse countNoteWords); absent for reactions and legacy rows
  })
    .index("by_workspace_at", ["workspaceId", "at"])
    .index("by_giver_at", ["giverId", "at"])
    .index("by_receiver_at", ["receiverId", "at"])
    .index("by_giver_receiver_at", ["giverId", "receiverId", "at"]) // quests: fresh / rekindle lookups
    .index("by_batch", ["batchId"])
    .index("by_message", ["workspaceId", "channelId", "messageTs"])
    .index("by_message_giver_source", ["workspaceId", "channelId", "messageTs", "giverId", "source"]),

  // One row per Slack message that carried the kudos emoji: how the attempt ended and which
  // reaction the bot put on the message. Redeliveries find it and stop; editing a failed
  // message re-evaluates it. Only attempts.ts writes this table.
  kudosAttempts: defineTable({
    workspaceId: v.id("workspaces"),
    channelId: v.string(),
    messageTs: v.string(),
    giverId: v.id("members"),
    outcome: attemptOutcomeValidator,
    reason: v.optional(invalidReasonValidator), // only for outcome "invalid"
    reaction: v.optional(v.string()), // Slack reaction the bot shows, once Slack confirmed it (✅ after a fallback)
    batchId: v.optional(v.string()), // the kudos batch, once given
    at: v.number(), // when the outcome was decided (an edit that fixes a failed attempt decides it again)
    editTs: v.optional(v.string()), // the last edit of the message handled, so a redelivered edit is a no-op
  })
    .index("by_message", ["workspaceId", "channelId", "messageTs"])
    .index("by_giver", ["giverId"]), // member removal (removal.ts)

  // Per-member daily rollup: powers allowances, leaderboards, streaks and cadence charts.
  memberDays: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    dayKey: v.string(),
    given: v.number(),
    received: v.number(),
    maxed: v.boolean(),
    // min(given, dailyLimit in force when it was given); lowered only by revokes. Absent on rows
    // written before rollups: read as min(given, current dailyLimit).
    capped: v.optional(v.number()),
  })
    .index("by_member_day", ["memberId", "dayKey"])
    .index("by_workspace_day", ["workspaceId", "dayKey"]),

  // Read-model rollups, maintained exactly inside give/revoke (lib/rollups.ts). Bucket keys are
  // pure functions of dayKey (lib/buckets.ts). All-zero rows are deleted: absent means zero.
  workspaceStats: defineTable({
    workspaceId: v.id("workspaces"),
    bucket: v.string(), // d:, w:, m:, q:, y: or all
    given: v.number(), // units given
    kudosRows: v.number(), // one per recipient
    messages: v.number(), // distinct batchIds
    givers: v.number(), // distinct members with given > 0 in the bucket
    receivers: v.number(), // distinct members with received > 0 in the bucket
    giverDays: v.number(), // memberDays rows with given > 0
    cappedGiven: v.number(), // Σ memberDays.capped: allowance used, at the limit in force when given
    maxedDays: v.number(),
    fromReactions: v.number(),
    fromMessages: v.number(), // every non-reaction source
    heat: v.array(v.number()), // day: 24 hours; longer buckets: 7 × 24, Monday-major
    found: rarityCountsValidator, // first discoveries of a message, by rarity
    // `all` row only: when the last full rebuild finished (convex/rollups.ts). Readers use the
    // rollups only once it is set; a row carrying it is kept even when every count is zero.
    rollupsBackfilledAt: v.optional(v.number()),
  }).index("by_workspace_bucket", ["workspaceId", "bucket"]),

  // The game's success metrics (spec #55 G18), per workspace month (`m:` bucket), maintained with
  // the other rollups. Givers and kudos rows per month are in `workspaceStats`.
  successStats: defineTable({
    workspaceId: v.id("workspaces"),
    bucket: v.string(), // m: only
    pairs: v.number(), // distinct giver → receiver pairs: Σ over givers of distinct recipients
    storyRows: v.number(), // kudos rows whose Note has 12+ words (a real "why")
    reciprocalRows: v.number(), // Reciprocal kudos rows: thanking someone back within 72 h
  }).index("by_workspace_bucket", ["workspaceId", "bucket"]),

  // Per-member w/m/q/y buckets. The day bucket is memberDays, all time is members.total*.
  memberStats: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    bucket: v.string(),
    given: v.number(),
    received: v.number(),
    maxedDays: v.number(),
    activeDays: v.number(), // days with given > 0
  })
    .index("by_member_bucket", ["memberId", "bucket"])
    .index("by_workspace_bucket_given", ["workspaceId", "bucket", "given"])
    .index("by_workspace_bucket_received", ["workspaceId", "bucket", "received"]),

  // Giver → receiver sums, w/m/q/y/all buckets.
  pairStats: defineTable({
    workspaceId: v.id("workspaces"),
    bucket: v.string(),
    giverId: v.id("members"),
    receiverId: v.id("members"),
    amount: v.number(),
  })
    .index("by_giver_bucket_receiver", ["giverId", "bucket", "receiverId"])
    .index("by_giver_bucket_amount", ["giverId", "bucket", "amount"])
    .index("by_receiver_bucket_amount", ["receiverId", "bucket", "amount"])
    .index("by_workspace_bucket_amount", ["workspaceId", "bucket", "amount"]),

  // Units per channel, w/m/q/y/all buckets. Private channels share one row so their names
  // never reach a workspace-wide table.
  channelStats: defineTable({
    workspaceId: v.id("workspaces"),
    bucket: v.string(),
    channel: v.string(), // channelName ?? channelId, or PRIVATE_CHANNELS
    amount: v.number(),
  })
    .index("by_workspace_bucket_channel", ["workspaceId", "bucket", "channel"])
    .index("by_workspace_bucket_amount", ["workspaceId", "bucket", "amount"]),

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
    .index("by_workspace_firstSeen", ["workspaceId", "firstSeenAt"])
    .index("by_workspace_template", ["workspaceId", "templateKey"]), // messageStats rebuild and verify

  // How many members have found each message (lib/rollups.ts), for the gallery: one row per
  // message anybody found, plus the ANY_MESSAGE row counting members who found any (collectors).
  // Maintained where discoveries are first inserted or deleted; all-zero rows are deleted.
  messageStats: defineTable({
    workspaceId: v.id("workspaces"),
    templateKey: v.string(), // a catalog key, or ANY_MESSAGE
    finders: v.number(), // distinct members with a discovery of it
  }).index("by_workspace_template", ["workspaceId", "templateKey"]),

  // A member who has given kudos while the game was on (game.ts). Absent: not a player, nothing accrues.
  players: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    since: v.number(), // their first kudos given while the game was on
    xp: v.number(), // sum of their gameEvents' xp; a revoke can take it below the level's floor
    level: v.number(), // the highest level reached: levels stay when a revoke takes XP back
    // Hog coins earned by their gameEvents (lib/coins.ts); undefined = 0. Level-up coins follow from `level`.
    coins: v.optional(v.number()),
  }).index("by_member", ["memberId"]),

  // The game ledger: what one kudos batch earned one member, written in the give transaction and
  // taken back line by line by a revoke (game.ts). One `give` event per batch for the giver (a line
  // per recipient row) and one `receive` event per recipient row that earned receiving XP.
  gameEvents: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    kind: v.union(v.literal("give"), v.literal("receive")),
    batchId: v.string(),
    dayKey: v.string(), // the kudos' workspace day: daily caps and same-day decay
    at: v.number(),
    xp: v.number(), // give: the sum of its lines; receive: the row's receiving XP
    coins: v.optional(v.number()), // Hog coins; give: the sum of its lines. Receiving never earns coins.
    // give: one line per recipient row (at most the daily allowance), kept even at 0 XP so later kudos decay
    lines: v.optional(
      v.array(
        v.object({
          kudosId: v.id("kudos"),
          receiverId: v.id("members"),
          qualifying: v.boolean(),
          xp: v.number(),
          coins: v.optional(v.number()), // 1 per kudos given when qualifying (lib/coins.ts lineCoins)
          items: v.array(v.object({ kind: xpItemKindValidator, xp: v.number() })),
        }),
      ),
    ),
    kudosId: v.optional(v.id("kudos")), // receive: the row
    giverId: v.optional(v.id("members")), // receive: one giver counts once a day
  })
    .index("by_member_day", ["memberId", "dayKey"])
    .index("by_batch", ["batchId"]),

  // Every message the bot sends (or would send, in the demo workspace).
  notifications: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    category: notificationCategoryValidator,
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
    // Messages the member had collected right after this one (absent on older rows).
    collected: v.optional(v.number()),
    // Quest messages only: the quest week as it stood right after this completion, for the DM.
    questProgress: v.optional(questProgressValidator),
    // giver_success while the game is on: what the kudos earned, for the reply where it was given.
    earnings: v.optional(earningsValidator),
    // level_up: the level reached and the skill points it grants.
    levelUp: v.optional(v.object({ level: v.number(), title: v.string(), skillPoints: v.number() })),
  }).index("by_member", ["memberId"]),

  // Rewards Store catalog. Archived, never deleted: redemptions link back to them.
  rewards: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    emoji: v.string(),
    cost: v.number(),
    stock: v.optional(v.number()), // remaining; undefined = unlimited
    maxPerMember: v.optional(v.number()), // lifetime cap; undefined = none
    prompt: v.optional(v.string()), // question the requester must answer
    status: v.union(v.literal("active"), v.literal("archived")),
    createdBy: v.id("members"),
    updatedAt: v.number(),
    // Maintained by the redemption helpers in store.ts; undefined = 0.
    openCount: v.optional(v.number()), // pending + approved requests
    fulfilledCount: v.optional(v.number()),
  }).index("by_workspace_status_cost", ["workspaceId", "status", "cost"]),

  // Weekly quests (lib/quests.ts). A board is stored the first time a mutation needs it, so a
  // running week never reshuffles. Progress is never stored: it's recomputed from kudos rows.
  questBoards: defineTable({
    workspaceId: v.id("workspaces"),
    weekKey: v.string(), // Monday YYYY-MM-DD in the workspace timezone
    questKeys: v.array(v.string()), // 3 catalog keys, display order
  }).index("by_workspace_week", ["workspaceId", "weekKey"]),

  questCompletions: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    weekKey: v.string(),
    questKey: v.string(),
    completedAt: v.number(),
    sweep: v.boolean(), // this completion cleared the board
    notificationId: v.optional(v.id("notifications")), // the Quest message (added with quest rewards)
  })
    .index("by_member_week", ["memberId", "weekKey"])
    .index("by_workspace_week", ["workspaceId", "weekKey"]),

  // One member's request for one reward. The cost is held (debited) at request time and
  // refunded on decline or cancel. Only the helpers in store.ts write this table.
  redemptions: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    rewardId: v.id("rewards"),
    rewardName: v.string(), // snapshot
    rewardEmoji: v.string(), // snapshot
    cost: v.number(), // snapshot: what was debited
    prompt: v.optional(v.string()),
    answer: v.optional(v.string()),
    status: redemptionStatusValidator,
    isOpen: v.boolean(), // pending or approved; lets the admin queue page FIFO over both
    stockHeld: v.optional(v.boolean()), // took one from stock, so a refund gives it back
    adminNote: v.optional(v.string()), // latest note from a decider
    history: v.array(
      // ≤ 3 entries (pending → approved → fulfilled), append-only
      v.object({ status: redemptionStatusValidator, at: v.number(), by: v.id("members"), note: v.optional(v.string()) }),
    ),
    requestedAt: v.number(),
    updatedAt: v.number(),
    // The admins' review DMs, rewritten after every step (≤ 20). `own`: the requester's own copy (sole admin).
    adminMessages: v.optional(v.array(v.object({ channel: v.string(), ts: v.string(), own: v.optional(v.boolean()) }))),
  })
    .index("by_workspace_status_requestedAt", ["workspaceId", "status", "requestedAt"])
    .index("by_workspace_isOpen_requestedAt", ["workspaceId", "isOpen", "requestedAt"])
    .index("by_member_requestedAt", ["memberId", "requestedAt"])
    .index("by_member_status", ["memberId", "status"])
    .index("by_member_reward_status", ["memberId", "rewardId", "status"]),

  // Audited balance changes that aren't recognition (admin corrections, quest rewards). Summed
  // into members.storeGranted; only grantBalance in store.ts writes this table.
  balanceAdjustments: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    amount: v.number(), // ±, never 0
    reason: v.string(),
    source: adjustmentSourceValidator, // "system" = quests (#5) or other automations
    by: v.optional(v.id("members")), // the admin who made it; undefined for system grants
    at: v.number(),
  })
    .index("by_member_at", ["memberId", "at"])
    .index("by_workspace_at", ["workspaceId", "at"]),

  slackEvents: defineTable({
    eventId: v.string(),
  }).index("by_eventId", ["eventId"]),

  oauthStates: defineTable({
    state: v.string(),
    expiresAt: v.number(),
  }).index("by_state", ["state"]),
});
