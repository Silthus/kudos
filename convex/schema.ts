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
 * What a notification is about: a rarity-rolled message category, or a DM of game gains that isn't
 * rolled (`gains`, `garden`). Only rolled categories become discoveries. `level_up` is legacy: the level-up
 * DMs written before #99, which now ride in `gains`; never written again.
 */
export const notificationCategoryValidator = v.union(categoryValidator, v.literal("gains"), v.literal("level_up"), v.literal("garden"));

/**
 * A `garden` DM (gardens.ts): a plant grown for the member. Unlike gains it reaches every teammate
 * who sees the game, players or not, as receiving is open to everyone. Stage DMs are `plant_stage` gains.
 */
export const gardenNoticeValidator = v.object({
  kind: v.literal("planted"),
  species: v.string(), // lib/garden.ts SpeciesId
  owner: v.string(), // the grower's name
});

const personValidator = v.object({ slackUserId: v.string(), name: v.string() });

/**
 * Something a member discovered or gained, told in a DM (#55 §G13; rendered by `lib/gains.ts`).
 * One DM carries everything one event gained. Never for XP or coins alone.
 */
export const gainValidator = v.union(
  // A new message, discovered where only they saw it (an ephemeral reply or a slash command).
  v.object({
    kind: v.literal("discovery"),
    category: categoryValidator,
    rarity: rarityValidator,
    slackText: v.string(),
    webText: v.string(),
    collected: v.number(),
    total: v.number(),
  }),
  // Reaching `level` from `from`: a skill point per level. `balance` only once the wallet is open.
  v.object({ kind: v.literal("level_up"), level: v.number(), from: v.number(), balance: v.optional(v.number()) }),
  v.object({ kind: v.literal("skill"), name: v.string(), branch: v.string(), description: v.optional(v.string()) }), // #92
  v.object({ kind: v.literal("item"), name: v.string(), description: v.optional(v.string()) }), // #91
  // #94: a spree the member started or joined reached a tier. `coins` only once their wallet is open.
  v.object({
    kind: v.literal("spree_tier"),
    tier: v.number(),
    role: v.union(v.literal("started"), v.literal("joined")),
    giver: personValidator,
    receivers: v.array(personValidator),
    xp: v.number(),
    coins: v.optional(v.number()),
  }),
  v.object({ kind: v.literal("plant_stage"), species: v.string(), stage: v.string(), teammate: personValidator }), // #95
);

/** A Super kudos note on a DM (#98): the receiver's celebration, or the giver's "sent" or how-to. */
export const superKudosNoteValidator = v.object({
  kind: v.union(v.literal("celebration"), v.literal("sent"), v.literal("howto")),
  slackText: v.string(),
  webText: v.string(),
});

export const xpItemKindValidator = v.union(
  v.literal("base"),
  v.literal("new_connection"),
  v.literal("story"),
  v.literal("rekindle"),
  v.literal("unsung"),
  v.literal("thin"),
  v.literal("boost"), // what a bonus day or booster added (lib/boosts.ts)
);

/** What a quest payment is for (lib/xp.ts `QUEST_REWARDS`). */
export const questScopeValidator = v.union(v.literal("weekly"), v.literal("daily"), v.literal("sweep"));
export const boostKindValidator = v.union(v.literal("double"), v.literal("new_connection"), v.literal("rekindle"), v.literal("unsung"));
export const boostSourceValidator = v.union(v.literal("schedule"), v.literal("booster"), v.literal("team_garden"), v.literal("capstone"));

/** What a kudos earned its giver, itemised for the earnings reply (lib/xp.ts `earningsText`). */
export const earningsValidator = v.object({
  xp: v.number(), // after the daily cap
  coins: v.optional(v.number()), // Hog coins it earned; only once the giver's wallet is open (level 3)
  bonuses: v.array(v.object({ kind: xpItemKindValidator, xp: v.number() })), // everything but base/thin, before the cap
  capped: v.boolean(), // the daily cap cut something
  noReason: v.boolean(), // some recipient got a kudos without a reason
  thankBack: v.boolean(), // some recipient was thanked back within 72 h
  // Quests this kudos completed from level 5 (§G11), each with what it paid.
  quests: v.optional(v.array(v.object({ scope: questScopeValidator, title: v.string(), xp: v.number(), coins: v.number() }))),
  boost: v.optional(boostKindValidator), // the bonus day or booster that doubled some of it
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
  v.literal("spree"), // a spree join, paid out to the receivers when a tier was reached (#94)
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
  spreesEnabled: v.optional(v.boolean()), // kudos sprees (#94), with or without the game; undefined = off
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
    // The old Rewards Store switch, when it was priced in received kudos (ADR 0001). Never read since
    // the Store moved to Hog coins (#91, ADR 0002): its prices were never re-set in coins.
    storeEnabled: v.optional(v.boolean()),
    // Real rewards (catalog, request → approve → fulfil) in the Store, priced in Hog coins; undefined = off.
    realRewardsEnabled: v.optional(v.boolean()),
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
    // Where bonus days and company-wide boosters are announced (#55 §G14; boosts.ts). Unset: only the in-app banner.
    announceChannel: v.optional(v.object({ id: v.string(), name: v.string() })),
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
    // The received-kudos Store balance (ADR 0001), reset, not converted (ADR 0002): never read since #91.
    storeSpent: v.optional(v.number()),
    storeGranted: v.optional(v.number()),
    coinsSpent: v.optional(v.number()), // Hog coins spent in the Store: items + non-refunded redemptions; undefined = 0
    coinsAdjusted: v.optional(v.number()), // Σ ± balance adjustments in Hog coins; undefined = 0
    gameHidden: v.optional(v.boolean()), // "Hide the game": no game UI or DMs for them; XP keeps accruing
    // The cosmetics they wear (#98, lib/cosmetics.ts): a cosmetic item key per slot, each one they bought.
    look: v.optional(v.object({ frame: v.optional(v.string()), banner: v.optional(v.string()), sticker: v.optional(v.string()) })),
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
    variant: v.optional(v.string()), // given with the giver's own kudos-emoji variant (#98): its suffix, e.g. "golden"
    superKudos: v.optional(v.literal(true)), // a Super kudos (#98): a `superKudos` row goes with it
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
    threadTs: v.optional(v.string()), // the thread the message is a reply in: spree prompts and tier replies go there (#94)
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
    // The skill tree (lib/skills.ts): the rank taken of each skill id; undefined = none taken.
    skills: v.optional(v.record(v.string(), v.number())),
    skillResets: v.optional(v.number()), // resets so far: each one costs more (resetCost)
    // Of `coins`, those from picking garden fruit (harvest events); undefined = 0. The rest came from kudos.
    fruitCoins: v.optional(v.number()),
    // The part of `coins` that quests paid (the wallet's breakdown); undefined = 0.
    questCoins: v.optional(v.number()),
    luckyCharms: v.optional(v.number()), // Lucky charm uses left (#97): each qualifying kudos rolls its receivers Uncommon+
    sunlamps: v.optional(v.number()), // Sunlamps bought and not yet used on a plant (#97)
    lanterns: v.optional(v.number()), // Lanterns bought and not yet hung (#97)
    spreeCoins: v.optional(v.number()), // Hog coins kudos sprees paid (#94, sprees.ts), part of `coins`; undefined = 0
  }).index("by_member", ["memberId"]),

  // A plant in a member's garden, grown for one teammate (gardens.ts, lib/garden.ts). Waterings are
  // never stored: they follow from the owner's kudos to the teammate. A memory is a plant with
  // `memoryAt`: uprooted, or grown for someone who left; it keeps the stage it had.
  plants: defineTable({
    workspaceId: v.id("workspaces"),
    ownerId: v.id("members"),
    forId: v.id("members"),
    species: v.string(), // lib/garden.ts SpeciesId
    plantedAt: v.number(),
    plantedDay: v.string(), // the owner's workspace day: its week never waters
    seedKudosId: v.optional(v.id("kudos")), // the qualifying kudos it was planted with (a revoke leaves the plant)
    pickedThrough: v.string(), // fruit is picked through this day; it grows again from the next
    announced: v.number(), // the highest stage index the owner was told about (never told twice)
    plot: v.optional(v.number()), // the key bed it grows in on the map (#129, lib/garden.ts assignPlots)
    checkOn: v.optional(v.string()), // the day a look for a stage reached by age alone is scheduled for
    memoryAt: v.optional(v.number()),
    memoryReason: v.optional(v.union(v.literal("uprooted"), v.literal("left"))),
    memoryStage: v.optional(v.number()), // the stage index it had when it became a memory
    // Days the owner used a Sunlamp on it (#97): each skips 5 days of its minimum-age wait from then on.
    sunlamps: v.optional(v.array(v.string())),
    // A teammate's Lantern (#97): a one-line note that glows for 7 days (lib/garden.ts LANTERN_DAYS).
    lantern: v.optional(v.object({ note: v.string(), at: v.number(), dayKey: v.string() })),
    lanternBy: v.optional(v.id("members")), // who hung it; kept apart so member removal finds it
    lanternQuietUntil: v.optional(v.string()), // a lantern was taken down: no new one before this day
  })
    .index("by_lantern_by", ["lanternBy"])
    .index("by_owner_memory", ["ownerId", "memoryAt"])
    .index("by_owner_for", ["ownerId", "forId", "memoryAt"])
    .index("by_for_memory", ["forId", "memoryAt"]),

  // Bonus days and company-wide boosters (#55 §G9, G10; boosts.ts): at most one per workspace day,
  // from `from` to the end of that day. Qualifying kudos given meanwhile earn their giver double XP
  // and Hog coins (all of them, or only the kind the booster is about). Never rewritten once
  // started: a rebuild replays every kudos with the boost that was on (game.ts), so removing a
  // member only forgets who started one.
  boosts: defineTable({
    workspaceId: v.id("workspaces"),
    dayKey: v.string(), // the workspace day it runs
    from: v.number(), // when it starts: the day's start when scheduled, the purchase when bought
    kind: boostKindValidator,
    source: boostSourceValidator,
    by: v.optional(v.id("members")), // who scheduled or bought it
    purchaseId: v.optional(v.id("itemPurchases")), // a booster: its purchase
    createdAt: v.number(),
    // The post in the announcement channel: sent, skipped (no channel, or the demo) or failed with Slack's error.
    announcement: v.optional(
      v.object({
        status: v.union(v.literal("pending"), v.literal("sent"), v.literal("skipped"), v.literal("failed")),
        channel: v.optional(v.string()), // its name, for the admin page
        channelId: v.optional(v.string()), // where it is (or was) posted, whatever the setting says since
        error: v.optional(v.string()),
      }),
    ),
  })
    .index("by_workspace_day", ["workspaceId", "dayKey"])
    .index("by_by", ["by"]),

  // Every change to a player's skill tree, in the transaction that made it (skills.ts): a skill
  // taken (one rank) or the whole tree reset for `coins`. The rebuild replays the Scout skills as
  // they stood when each kudos was given; it's also the audit trail of what resets cost.
  skillChanges: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    at: v.number(),
    kind: v.union(v.literal("take"), v.literal("reset")),
    skill: v.optional(v.string()), // take: the skill id
    coins: v.optional(v.number()), // reset: the Hog coins it cost
  }).index("by_member_at", ["memberId", "at"]),

  // The game ledger: what one kudos batch earned one member, written in the give transaction and
  // taken back line by line by a revoke (game.ts). One `give` event per batch for the giver (a line
  // per recipient row) and one `receive` event per recipient row that earned receiving XP.
  gameEvents: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    // harvest: garden fruit picked (gardens.ts pick); a member's action, kept as it is by a rebuild.
    // quest: a weekly or daily quest or a clean sweep, paid from level 5 (quests.ts). Its `batchId`
    // is `quest:<completion>` or `sweep:<member>:<week>`, so a kudos revoke never matches it directly.
    // spree: what one tier of a kudos spree paid one member (#94), keyed `spree:<spreeId>`; rebuilds keep it
    kind: v.union(v.literal("give"), v.literal("receive"), v.literal("harvest"), v.literal("quest"), v.literal("spree")),
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
          boosted: v.optional(v.literal(true)), // a bonus day or booster doubled its XP and coins
        }),
      ),
    ),
    kudosId: v.optional(v.id("kudos")), // receive: the row
    giverId: v.optional(v.id("members")), // receive: one giver counts once a day
    fruit: v.optional(v.number()), // harvest: fruit picked
    quest: v.optional(v.object({ scope: questScopeValidator, key: v.string() })), // quest: its catalog key; sweep: the week
    completionId: v.optional(v.union(v.id("questCompletions"), v.id("dailyQuestCompletions"))), // quest: what it paid for
    tier: v.optional(v.number()), // spree: the tier reached (1–5)
    role: v.optional(v.union(v.literal("joined"), v.literal("started"), v.literal("received"))), // spree
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
    // Legacy (before #99): a level_up row's level. Level-ups are gains now.
    levelUp: v.optional(v.object({ level: v.number(), title: v.string(), skillPoints: v.number() })),
    // What the member discovered or gained in the event this DM is about (the whole DM for `gains`).
    gains: v.optional(v.array(gainValidator)),
    // garden: the plant grown for the member.
    garden: v.optional(gardenNoticeValidator),
    // A Super kudos (#98): the receiver's celebration, or what the giver's Super kudos emoji did.
    superKudos: v.optional(superKudosNoteValidator),
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
    // "coins": priced in Hog coins (set on every create and edit since #91). Absent: priced in
    // received kudos (ADR 0001), so it stays off the shelves until an admin re-saves its price.
    unit: v.optional(v.literal("coins")),
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
    // The week's clean-sweep pay (game on, #93) is tied to this completion: it only goes back when a
    // revoke removes it, so a rebuild pays the sweep here too.
    sweepPaid: v.optional(v.boolean()),
  })
    .index("by_member_week", ["memberId", "weekKey"])
    .index("by_workspace_week", ["workspaceId", "weekKey"]),

  // Daily quests (lib/quests.ts): only with the game on, from level 5. One row per member and day
  // the day's quest was met; it pays XP and Hog coins (a `quest` game event), no Quest message.
  dailyQuestCompletions: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    dayKey: v.string(), // the workspace day
    questKey: v.string(), // the day's draw (lib/quests.ts dailyQuestKey)
    completedAt: v.number(),
  })
    .index("by_member_day", ["memberId", "dayKey"])
    .index("by_workspace_day", ["workspaceId", "dayKey"]),

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
    // "coins": priced and held in Hog coins (#91). Absent: a request from the received-kudos Store
    // (ADR 0001), whose cost never touched `coinsSpent`, so a refund gives back no coins.
    unit: v.optional(v.literal("coins")),
    // The admins' review DMs, rewritten after every step (≤ 20). `own`: the requester's own copy (sole admin).
    adminMessages: v.optional(v.array(v.object({ channel: v.string(), ts: v.string(), own: v.optional(v.boolean()) }))),
  })
    .index("by_workspace_status_requestedAt", ["workspaceId", "status", "requestedAt"])
    .index("by_workspace_isOpen_requestedAt", ["workspaceId", "isOpen", "requestedAt"])
    .index("by_member_requestedAt", ["memberId", "requestedAt"])
    .index("by_member_status", ["memberId", "status"])
    .index("by_member_reward_status", ["memberId", "rewardId", "status"]),

  // Audited balance changes that aren't recognition (admin corrections, automations). Summed into
  // members.coinsAdjusted; only grantBalance in store.ts writes this table.
  balanceAdjustments: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    amount: v.number(), // ±, never 0
    reason: v.string(),
    source: adjustmentSourceValidator, // "system" = quests (#5) or other automations
    by: v.optional(v.id("members")), // the admin who made it; undefined for system grants
    at: v.number(),
    unit: v.optional(v.literal("coins")), // absent: a received-kudos adjustment (ADR 0001), in no balance
  })
    .index("by_member_at", ["memberId", "at"])
    .index("by_member_unit_at", ["memberId", "unit", "at"])
    .index("by_workspace_at", ["workspaceId", "at"]),

  // Super kudos (#98, #55 §G7 Herald): one row per Super kudos given, written in its give transaction;
  // a revoke of the kudos deletes it. Months and quarters are the workspace's, as when it was given.
  // Gardens (#95) read the golden leaves on a giver's plant for a teammate from `by_giver_receiver_quarter`.
  superKudos: defineTable({
    workspaceId: v.id("workspaces"),
    giverId: v.id("members"),
    receiverId: v.id("members"),
    kudosId: v.id("kudos"),
    month: v.string(), // "YYYY-MM": a giver has 1 (2 with Encore) a month
    quarter: v.string(), // "q:YYYY-Qn": never to the same person twice in one
    at: v.number(),
    note: v.string(), // the message as the kudos shows it, for the receiver's celebration
    spotlight: v.optional(v.literal(true)), // featured in the announcement channel (Spotlight skill)
    seenAt: v.optional(v.number()), // when the receiver dismissed their celebration on the web
  })
    .index("by_giver_month", ["giverId", "month"])
    .index("by_giver_receiver_quarter", ["giverId", "receiverId", "quarter"])
    .index("by_receiver_at", ["receiverId", "at"])
    .index("by_kudos", ["kudosId"])
    .index("by_workspace_at", ["workspaceId", "at"]),

  // Game items bought in the Store (lib/items.ts): applied instantly, no approval. The price is
  // added to members.coinsSpent in the same transaction; only buyItem in store.ts writes this table.
  itemPurchases: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("members"),
    item: v.string(), // an ItemKey
    price: v.number(), // Hog coins, as quoted to the member
    month: v.string(), // "YYYY-MM" in the workspace timezone: monthly limits count by it
    at: v.number(),
  })
    .index("by_member_item_month", ["memberId", "item", "month"])
    .index("by_workspace", ["workspaceId"]),

  // A kudos spree (#94, lib/sprees.ts): a thoughtful, bot-confirmed kudos teammates joined. Created
  // by its first join; only sprees.ts writes it. `joiners` counts waiting + paid joins.
  sprees: defineTable({
    workspaceId: v.id("workspaces"),
    batchId: v.string(), // the kudos it grew on
    channelId: v.string(),
    channelName: v.optional(v.string()),
    channelPrivate: v.optional(v.boolean()),
    messageTs: v.string(),
    threadTs: v.optional(v.string()), // where tier replies go: the kudos' thread
    giverId: v.id("members"),
    receiverIds: v.array(v.id("members")), // the kudos' qualifying receivers (≤ the daily allowance)
    text: v.string(), // the kudos' text, for the pooled rows
    kudosAt: v.number(),
    status: v.union(v.literal("open"), v.literal("complete"), v.literal("lapsed"), v.literal("cancelled")),
    tier: v.number(), // tiers reached (0–5)
    joiners: v.number(),
    deadline: v.number(), // the next tier must be reached before this
    tiers: v.array(v.object({ tier: v.number(), at: v.number(), joiners: v.number() })), // ≤ 5
  })
    .index("by_message", ["workspaceId", "channelId", "messageTs"])
    .index("by_batch", ["batchId"])
    .index("by_giver", ["giverId"])
    .index("by_workspace_kudosAt", ["workspaceId", "kudosAt"]),

  // One member's join of one spree. A waiting join reserves `amount` of the joiner's kudos on
  // `dayKey` (engine.ts `usedOn`); waiting and paid joins use one of that month's spree joins.
  spreeJoins: defineTable({
    workspaceId: v.id("workspaces"),
    spreeId: v.id("sprees"),
    memberId: v.id("members"),
    // due: its tier was reached, its kudos are being written (sprees.ts payDue); still reserves and counts
    status: v.union(v.literal("waiting"), v.literal("due"), v.literal("paid"), v.literal("withdrawn"), v.literal("lapsed")),
    at: v.number(),
    dayKey: v.string(), // the joiner's workspace day: the kudos reserved are that day's
    month: v.string(), // "YYYY-MM": the month whose spree joins it uses
    amount: v.number(), // kudos reserved: one per receiver
    tier: v.optional(v.number()), // paid: the tier that paid it out
    batchId: v.optional(v.string()), // paid: its kudos rows
  })
    .index("by_spree_member", ["spreeId", "memberId"])
    .index("by_spree_status", ["spreeId", "status"])
    .index("by_member_day", ["memberId", "dayKey"])
    .index("by_member_month", ["memberId", "month"])
    .index("by_workspace", ["workspaceId"]),

  slackEvents: defineTable({
    eventId: v.string(),
  }).index("by_eventId", ["eventId"]),

  oauthStates: defineTable({
    state: v.string(),
    expiresAt: v.number(),
  }).index("by_state", ["state"]),
});
