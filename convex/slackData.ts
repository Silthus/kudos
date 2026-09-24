import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { allowanceCheck, ensureMember, remainingToday } from "./engine";
import { RARITY_SLACK_BADGE, type Rarity } from "./lib/messages";
import { DEFAULT_SETTINGS } from "./lib/settings";
import { MAX_ACTIVE_REWARDS } from "./lib/store";
import { realRewardsOn, SHOP_LEVEL, shopAccess } from "./lib/items";
import { activeRewards, coinWallet, openRedemptionCount, ownDecisionBlocker, pricedInCoins, shopItems, transitionRedemption } from "./store";
import { openRequestCount } from "./storeAdmin";
import { earningsValidator, gainValidator, questProgressValidator, redemptionStatusValidator } from "./schema";
import { escapeMrkdwn, rewardLine, webLink } from "./lib/slack";
import { addDays, dayKeyFor, weekdayOfKey } from "./lib/time";
import { weekBucket } from "./lib/buckets";
import { backfilledRollups, memberBucket } from "./lib/stats";
import { markBackfilled, mirrorBackfillMarker } from "./lib/rebuild";
import { questBoard, questsOn } from "./quests";
import { gameOn, gameShownTo, gameView, playerOf } from "./game";
import { gameBlocks, number } from "./lib/gameBlocks";
import { coinBalance, formatCoins, WALLET_LEVEL } from "./lib/coins";
import { questBlocks } from "./lib/questBlocks";

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
    // Readers use the rollups once a workspace is backfilled. A new one has no history, and the
    // engine keeps its rollups exact from the first give; a returning one without it is rebuilt.
    if (isFirstInstall) await markBackfilled(ctx, workspace._id, Date.now());
    else if (!(await backfilledRollups(ctx, workspace._id))) {
      await ctx.scheduler.runAfter(0, internal.rollups.rebuildWorkspace, { workspaceId: workspace._id });
    } else await mirrorBackfillMarker(ctx, workspace);
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
      questProgress: v.optional(questProgressValidator),
      earnings: v.optional(earningsValidator),
      gains: v.optional(v.array(gainValidator)),
    }),
  ),
  handler: async (ctx, { ids }) => {
    const out = [];
    for (const id of ids) {
      const n = await ctx.db.get(id);
      if (!n) continue;
      const member = await ctx.db.get(n.memberId);
      if (!member) continue;
      // Older rows don't know their count: fall back to the collection as it is now. Game DMs
      // aren't rolled messages, so they have none to show.
      const gameOnly = n.category === "gains" || n.category === "level_up";
      const discoveredCount =
        n.collected ??
        (gameOnly
          ? 0
          : (await ctx.db
              .query("discoveries")
              .withIndex("by_member_template", (q) => q.eq("memberId", member._id))
              .take(500)).length);
      out.push({
        _id: n._id,
        slackUserId: member.slackUserId,
        slackText: n.slackText,
        rarity: n.rarity,
        category: n.category,
        isNewDiscovery: n.isNewDiscovery,
        discoveredCount,
        delivery: n.delivery,
        ...(n.questProgress ? { questProgress: n.questProgress } : {}),
        ...(n.earnings ? { earnings: n.earnings } : {}),
        ...(n.gains ? { gains: n.gains } : {}),
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
    // Gone if its member was removed (`removal.ts`) while it was on its way.
    if (!(await ctx.db.get(id))) return null;
    await ctx.db.patch(id, { delivery, error });
    return null;
  },
});

type WeekStanding = {
  /** The week's most generous givers, most first. */
  top: { memberId: Id<"members">; given: number }[];
  /** `memberId`'s units given this week, and their rank: ties share it, and it's null before they give. */
  mine: { given: number; rank: number | null };
};

/**
 * This week's giving (the ISO week holding `now` in the workspace timezone). Reads the week's
 * `memberStats` once the workspace is backfilled: the top rows, the member's own row and the
 * rows ahead of it. Before that, the week's `memberDays`.
 */
export async function weekStanding(
  ctx: QueryCtx,
  workspace: Doc<"workspaces">,
  now: number,
  memberId: Id<"members"> | null,
  limit: number,
): Promise<WeekStanding> {
  const today = dayKeyFor(now, workspace.timezone);
  if (!(await backfilledRollups(ctx, workspace._id))) return await legacyWeekStanding(ctx, workspace, today, memberId, limit);
  const bucket = weekBucket(today);
  const top = (await memberBucket(ctx, workspace._id, bucket, "given", limit)).map((r) => ({ memberId: r.memberId, given: r.given }));
  const mine = memberId
    ? await ctx.db
        .query("memberStats")
        .withIndex("by_member_bucket", (q) => q.eq("memberId", memberId).eq("bucket", bucket))
        .unique()
    : null;
  if (!mine || mine.given === 0) return { top, mine: { given: 0, rank: null } };
  const ahead = await ctx.db
    .query("memberStats")
    .withIndex("by_workspace_bucket_given", (q) => q.eq("workspaceId", workspace._id).eq("bucket", bucket).gt("given", mine.given))
    .take(MAX_WEEK_GIVERS);
  return { top, mine: { given: mine.given, rank: ahead.length + 1 } };
}

/** Bounds the givers read for a week rank; the read models are sized for ~500 members. */
const MAX_WEEK_GIVERS = 5_000;

async function legacyWeekStanding(
  ctx: QueryCtx,
  workspace: Doc<"workspaces">,
  today: string,
  memberId: Id<"members"> | null,
  limit: number,
): Promise<WeekStanding> {
  const start = addDays(today, -weekdayOfKey(today));
  const days = await ctx.db
    .query("memberDays")
    .withIndex("by_workspace_day", (q) =>
      q.eq("workspaceId", workspace._id).gte("dayKey", start).lte("dayKey", today),
    )
    .take(8000);
  const totals = new Map<Id<"members">, number>();
  for (const d of days) if (d.given > 0) totals.set(d.memberId, (totals.get(d.memberId) ?? 0) + d.given);
  const standing = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const given = (memberId && totals.get(memberId)) || 0;
  return {
    top: standing.slice(0, limit).map(([memberId, given]) => ({ memberId, given })),
    mine: { given, rank: given > 0 ? standing.filter(([, g]) => g > given).length + 1 : null },
  };
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
    const standing = await weekStanding(ctx, workspace, now, member?._id ?? null, 5);
    const top = [];
    for (const { memberId, given } of standing.top) {
      const m = await ctx.db.get(memberId);
      if (m) top.push({ slackUserId: m.slackUserId, given });
    }
    const discovered = member
      ? (
          await ctx.db
            .query("discoveries")
            .withIndex("by_member_template", (q) => q.eq("memberId", member._id))
            .take(500)
        ).length
      : 0;
    return {
      slackTeamId: workspace.slackTeamId,
      emojiName: workspace.emojiName,
      dailyLimit: workspace.dailyLimit,
      showReceived: workspace.receivedVisibility !== "hidden",
      remaining: member ? await remainingToday(ctx, workspace, member._id, now) : workspace.dailyLimit,
      totalGiven: member?.totalGiven ?? 0,
      totalReceived: member?.totalReceived ?? 0,
      weekGiven: standing.mine.given,
      weekRank: standing.mine.rank,
      discovered,
      top,
      store: member && realRewardsOn(workspace) ? await storeHome(ctx, workspace, member) : null,
      quests: member ? await questBoard(ctx, workspace, member, dayKeyFor(now, workspace.timezone)) : null,
      // The game's invitation (§G1): shown until the member gives their first kudos, never as a DM.
      invite: gameShownTo(workspace, member ?? {}) && !(member && (await playerOf(ctx, member._id))),
      game: member ? await gameView(ctx, workspace, member, now) : null,
    };
  },
});

/** A context line in a slash-command reply; none for a link that can't be built. */
const context = (text: string | null) => (text ? [{ type: "context", elements: [{ type: "mrkdwn", text }] }] : []);

/** Rewards on the shelf now: active and not sold out, cheapest first. */
async function shelf(ctx: QueryCtx, workspace: Doc<"workspaces">) {
  return (await activeRewards(ctx, workspace._id))
    .slice(0, MAX_ACTIVE_REWARDS)
    .filter((r) => pricedInCoins(r) && (r.stock === undefined || r.stock > 0))
    .map((r) => ({ emoji: r.emoji, name: r.name, cost: r.cost }));
}

/**
 * The App Home "Rewards store" section while real rewards are on: the Hog coin balance and the 3
 * dearest rewards it covers (topped up with the cheapest it doesn't, as the next goal) once the
 * Store is open to the member (level 5), and for admins, whatever their level, the requests waiting.
 */
async function storeHome(ctx: QueryCtx, workspace: Doc<"workspaces">, member: Doc<"members">) {
  const { level, coins } = await coinWallet(ctx, member._id);
  if (shopAccess(workspace, member, level) !== "open") {
    return member.isAdmin ? { balance: null, rewards: [], waiting: await openRequestCount(ctx, workspace._id) } : null;
  }
  const { balance } = coins;
  const rewards = await shelf(ctx, workspace);
  const affordable = rewards.filter((r) => r.cost <= balance).slice(-3).reverse();
  const goals = rewards.filter((r) => r.cost > balance).slice(0, 3 - affordable.length);
  return {
    balance,
    rewards: [...affordable, ...goals],
    waiting: member.isAdmin ? await openRequestCount(ctx, workspace._id) : null,
  };
}

/**
 * `/kudos store`: the Store in Hog coins. Locked below level 5, with how to get there; open, the
 * balance, the game items and, while an admin has them on, real rewards and open requests.
 */
async function storeReply(ctx: QueryCtx, workspace: Doc<"workspaces">, member: Doc<"members">, link: (path: string, label: string) => string | null) {
  const { level, coins, player } = await coinWallet(ctx, member._id);
  switch (shopAccess(workspace, member, level)) {
    case "off":
      return { response_type: "ephemeral", text: "The game isn't on in this workspace, so there's no Store." };
    case "hidden":
      return { response_type: "ephemeral", text: "You've hidden the game. Show it again on your Me page to shop." };
    case "locked":
      return { response_type: "ephemeral", text: `The Store opens at level ${SHOP_LEVEL}. You're level ${level}: thoughtful kudos get you there.` };
    case "open":
      break;
  }
  const { balance } = coins;
  if (!player) return { response_type: "ephemeral", text: `The Store opens at level ${SHOP_LEVEL}.` };
  const month = dayKeyFor(Date.now(), workspace.timezone).slice(0, 7);
  const items = (await shopItems(ctx, { workspace, member, player }, month, balance)).map(
    (item) => `${escapeMrkdwn(item.name)} · ${formatCoins(item.price)}${item.blocked ? `  _${escapeMrkdwn(item.blocked)}_` : ""}`,
  );
  const real = realRewardsOn(workspace);
  const rewards = real ? (await shelf(ctx, workspace)).slice(0, 5) : [];
  const fields = [`*Balance*\n${formatCoins(balance)}`, ...(real ? [`*Open requests*\n${await openRedemptionCount(ctx, member._id)}`] : [])];
  return {
    response_type: "ephemeral",
    text: `You have ${formatCoins(balance)} to spend.`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "Store" } },
      { type: "section", fields: fields.map((text) => ({ type: "mrkdwn", text })) },
      { type: "section", text: { type: "mrkdwn", verbatim: true, text: `*Game items*, instantly yours\n${items.join("\n")}` } },
      ...(real
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                verbatim: true,
                text: `*Rewards*, an admin hands them over\n${rewards.map((r) => rewardLine(r, balance)).join("\n") || "_The shelves are empty. Your admins are still stocking the store._"}`,
              },
            },
          ]
        : []),
      ...context(link("/store", "Open the store")),
    ],
  };
}

/** The game is on and the member (if Kudos knows them yet) hasn't hidden it. */
async function gameShownToSlackUser(ctx: QueryCtx, workspace: Doc<"workspaces">, slackUserId: string) {
  if (!gameOn(workspace)) return false;
  const member = await ctx.db
    .query("members")
    .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspace._id).eq("slackUserId", slackUserId))
    .unique();
  return !member?.gameHidden;
}

/**
 * `/kudos coins`: the member's Hog coin wallet. Coins collect silently until it opens at level 3,
 * so before that it only says when it opens, never the amount.
 */
async function coinsReply(ctx: QueryCtx, workspace: Doc<"workspaces">, member: Doc<"members">, link: (path: string, label: string) => string | null) {
  if (!gameOn(workspace)) return { response_type: "ephemeral", text: "The game isn't on in this workspace." };
  if (!gameShownTo(workspace, member)) {
    return { response_type: "ephemeral", text: "You've hidden the game. Show it again on your Me page to see your Hog coins." };
  }
  const player = await playerOf(ctx, member._id);
  if (!player || player.level < WALLET_LEVEL) {
    return {
      response_type: "ephemeral",
      text: `Your Hog coin wallet opens at level ${WALLET_LEVEL}. Thoughtful kudos are already collecting coins for it.`,
    };
  }
  const coins = coinBalance(player, member);
  const fields = [
    `*Balance*\n${coins.balance} Hog ${coins.balance === 1 ? "coin" : "coins"}`,
    `*From thoughtful kudos*\n${coins.fromKudos}`,
    ...(coins.fromFruit ? [`*From garden fruit*\n${coins.fromFruit}`] : []),
    ...(coins.fromQuests ? [`*From quests*\n${coins.fromQuests}`] : []),
    `*From level-ups*\n${coins.fromLevels}`,
    ...(coins.spent ? [`*Spent*\n${coins.spent}`] : []),
    ...(coins.adjusted ? [`*Adjusted by admins*\n${coins.adjusted > 0 ? "+" : ""}${coins.adjusted}`] : []),
  ];
  const note =
    coins.balance < 0
      ? "A revoked kudos took back coins it had earned. Spending waits until your balance is above zero again."
      : `A thoughtful kudos earns you 1 Hog coin per kudos given, and every level 10${coins.fromQuests ? ". Quests pay more on top" : ""}.`;
  return {
    response_type: "ephemeral",
    text: `You have ${coins.balance} Hog ${coins.balance === 1 ? "coin" : "coins"}.`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "Hog coins" } },
      { type: "section", fields: fields.map((text) => ({ type: "mrkdwn", text })) },
      ...context([note, link("/me", "Your wallet")].filter(Boolean).join(" · ")),
    ],
  };
}

/**
 * `/kudos level`: the member's game, the same blocks as their App Home. Never an amount of coins
 * below level 3, and nothing while the game is hidden or off.
 */
async function levelReply(ctx: QueryCtx, workspace: Doc<"workspaces">, member: Doc<"members">) {
  if (!gameOn(workspace)) return { response_type: "ephemeral", text: "The game isn't on in this workspace." };
  if (!gameShownTo(workspace, member)) {
    return { response_type: "ephemeral", text: "You've hidden the game. Show it again on your Me page to see your level." };
  }
  const game = await gameView(ctx, workspace, member, Date.now());
  if (!game) {
    return { response_type: "ephemeral", text: "You don't have a level yet. Give your first kudos with a few words on why to start one." };
  }
  const next = game.toNext === null ? "the top level." : `${number(game.toNext)} XP to level ${game.level + 1}.`;
  return {
    response_type: "ephemeral",
    text: `Level ${game.level} · ${game.title}: ${next}`,
    blocks: gameBlocks(game, webLink(workspace.slackTeamId, "/me")),
  };
}

/** `/kudos [me|top|quests|level|coins|store|help]` — returns an ephemeral Slack response body. */
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
    const link = (path: string, label: string) => {
      const url = webLink(workspace.slackTeamId, path);
      return url ? `<${url}|${label}>` : null;
    };
    const e = `:${workspace.emojiName}:`;
    const sub = text.trim().toLowerCase();
    if (sub === "top" || sub === "leaderboard") {
      const { top } = await weekStanding(ctx, workspace, Date.now(), null, 10);
      const lines = [];
      for (const [i, { memberId, given }] of top.entries()) {
        const m = await ctx.db.get(memberId);
        if (m) lines.push(`${["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} <@${m.slackUserId}> · ${given} ${e}`);
      }
      return {
        response_type: "ephemeral",
        blocks: [
          { type: "header", text: { type: "plain_text", text: "This week's most generous" } },
          { type: "section", text: { type: "mrkdwn", text: lines.join("\n") || "_Nobody has given kudos this week yet. Be the first!_" } },
          ...context(link("/leaderboard", "Open the full leaderboard")),
        ],
      };
    }
    if (sub === "" || sub === "me" || sub === "stats" || sub === "left") {
      const member = await ensureMember(ctx, workspace, slackUserId);
      const { notificationId, remaining, gainIds } = await allowanceCheck(ctx, workspace, member, Date.now());
      // The slash command response *is* the delivery; a message it discovered is a DM of its own.
      await ctx.db.patch(notificationId, { delivery: "sent" });
      if (gainIds.length > 0) await ctx.scheduler.runAfter(0, internal.slack.deliverNotifications, { workspaceId: workspace._id, ids: gainIds });
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
            elements: [
              {
                type: "mrkdwn",
                text: [RARITY_SLACK_BADGE[n.rarity as Rarity], n.isNewDiscovery ? "✨ New discovery!" : null, link("/me", "Your dashboard")].filter(Boolean).join(" · "),
              },
            ],
          },
        ],
      };
    }
    const quests = questsOn(workspace);
    if (sub === "quests" || sub === "quest") {
      if (!quests) return { response_type: "ephemeral", text: "Weekly quests aren't on in this workspace." };
      const member = await ensureMember(ctx, workspace, slackUserId);
      const board = await questBoard(ctx, workspace, member, dayKeyFor(Date.now(), workspace.timezone));
      if (!board.enabled && board.hidden) {
        return { response_type: "ephemeral", text: "Quests are part of the game, which you've hidden. Show it again on your Me page to see them." };
      }
      return { response_type: "ephemeral", text: "This week's quests", blocks: questBlocks(board, webLink(workspace.slackTeamId, "/quests")) };
    }
    if (sub === "level" || sub === "lvl" || sub === "xp") {
      return await levelReply(ctx, workspace, await ensureMember(ctx, workspace, slackUserId));
    }
    if (sub === "coins" || sub === "coin" || sub === "wallet") {
      return await coinsReply(ctx, workspace, await ensureMember(ctx, workspace, slackUserId), link);
    }
    // `/kudos balance` was the received-kudos Store balance; the balance is Hog coins now (ADR 0002).
    if (sub === "balance") return await coinsReply(ctx, workspace, await ensureMember(ctx, workspace, slackUserId), link);
    if (sub === "store" || sub === "shop") return await storeReply(ctx, workspace, await ensureMember(ctx, workspace, slackUserId), link);
    return {
      response_type: "ephemeral",
      text: [
        `*How Kudos works* ${e}`,
        `• Mention teammates and add ${e} to your message: \`@ana @ben ${e}${e} thanks for the release!\``,
        `• Each ${e} gives one kudos to *every* person mentioned. You can give ${workspace.dailyLimit} per day.`,
        workspace.reactionsEnabled ? `• React with ${e} on a message to give its author one kudos.` : "",
        "• The bot answers with messages of different rarities. Collect them all!",
        "",
        "`/kudos me` what you can give today · `/kudos top` weekly leaderboard",
        quests ? "`/kudos quests` your weekly quests" : "",
        (await gameShownToSlackUser(ctx, workspace, slackUserId)) ? "`/kudos level` your level · `/kudos coins` your Hog coins" : "",
        (await gameShownToSlackUser(ctx, workspace, slackUserId)) ? "`/kudos store` what your Hog coins can buy" : "",
        link("/me", "Open the Kudos dashboard"),
      ]
        .filter(Boolean)
        .join("\n"),
    };
  },
});


// ── Rewards Store ────────────────────────────────────────────────────────────

/** Admin DMs for one request go to at most this many admins, signed-in ones first. */
const MAX_ADMIN_DMS = 20;
/** Admin rows read to pick them from; Slack sync makes every workspace admin a Kudos admin. */
const MAX_ADMINS_READ = 200;

/**
 * Everything `slack.notifyRedemption` needs to tell people about one redemption, or null
 * when the workspace can't be reached in Slack (uninstalled, demo). `admins` is only
 * filled while a new request is still pending. `storeOpen` says whether the web Store page
 * exists to link to. Hog coin balances are always shown: they come from giving (ADR 0002).
 */
export const redemptionForSlack = internalQuery({
  args: { redemptionId: v.id("redemptions"), withAdmins: v.boolean() },
  returns: v.union(
    v.null(),
    v.object({
      workspaceId: v.id("workspaces"),
      slackTeamId: v.string(),
      botToken: v.string(),
      emojiName: v.string(),
      storeOpen: v.boolean(),
      status: redemptionStatusValidator,
      requester: v.object({ slackUserId: v.string(), name: v.string(), deactivated: v.boolean() }),
      // legacy: a request from the received-kudos Store (ADR 0001), priced in kudos; a refund gives back no coins.
      reward: v.object({ name: v.string(), emoji: v.string(), cost: v.number(), legacy: v.boolean() }),
      prompt: v.optional(v.string()),
      answer: v.optional(v.string()),
      history: v.array(
        v.object({ status: redemptionStatusValidator, bySlackUserId: v.union(v.string(), v.null()), note: v.optional(v.string()) }),
      ),
      admins: v.array(v.object({ slackUserId: v.string(), isOwn: v.boolean() })),
    }),
  ),
  handler: async (ctx, { redemptionId, withAdmins }) => {
    const redemption = await ctx.db.get(redemptionId);
    if (!redemption) return null;
    const workspace = await ctx.db.get(redemption.workspaceId);
    if (!workspace || workspace.status !== "active" || workspace.isDemo) return null;
    const install = await ctx.db
      .query("slackInstallations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .unique();
    const requester = await ctx.db.get(redemption.memberId);
    if (!install || !requester) return null;
    const slackIds = new Map<Id<"members">, string | null>();
    for (const h of redemption.history) {
      if (!slackIds.has(h.by)) slackIds.set(h.by, (await ctx.db.get(h.by))?.slackUserId ?? null);
    }

    // Asking admins to review a request that was already cancelled or decided helps nobody.
    const admins: { slackUserId: string; isOwn: boolean; signedIn: boolean }[] = [];
    if (withAdmins && redemption.status === "pending") {
      const rows = await ctx.db
        .query("members")
        .withIndex("by_workspace_isAdmin", (q) => q.eq("workspaceId", workspace._id).eq("isAdmin", true))
        .take(MAX_ADMINS_READ);
      for (const admin of rows) {
        if (admin._id === requester._id || admin.deactivated || admin.isBot) continue;
        admins.push({ slackUserId: admin.slackUserId, isOwn: false, signedIn: Boolean(admin.userId) });
      }
      admins.sort((a, b) => Number(b.signedIn) - Number(a.signedIn));
      // An admin only reviews their own request when nobody else can (the four-eyes rule).
      if (requester.isAdmin && !requester.deactivated && (await ownDecisionBlocker(ctx, workspace, requester)) === null) {
        admins.unshift({ slackUserId: requester.slackUserId, isOwn: true, signedIn: true });
      }
      admins.splice(MAX_ADMIN_DMS);
    }

    return {
      workspaceId: workspace._id,
      slackTeamId: workspace.slackTeamId,
      botToken: install.botToken,
      emojiName: workspace.emojiName,
      storeOpen: gameOn(workspace), // the Store page (and My requests in it) exists while the game is on
      status: redemption.status,
      requester: { slackUserId: requester.slackUserId, name: requester.name, deactivated: requester.deactivated },
      reward: { name: redemption.rewardName, emoji: redemption.rewardEmoji, cost: redemption.cost, legacy: redemption.unit !== "coins" },
      prompt: redemption.prompt,
      answer: redemption.answer,
      history: redemption.history.map((h) => ({
        status: h.status,
        bySlackUserId: slackIds.get(h.by) ?? null,
        ...(h.note ? { note: h.note } : {}),
      })),
      admins: admins.map(({ slackUserId, isOwn }) => ({ slackUserId, isOwn })),
    };
  },
});

/**
 * Remembers where the admins' review DMs landed, so `slack.syncAdminMessages` can rewrite them.
 * A step may already have happened while they went out; then those copies are synced right away.
 */
export const saveAdminMessages = internalMutation({
  args: { redemptionId: v.id("redemptions"), messages: v.array(v.object({ channel: v.string(), ts: v.string(), own: v.optional(v.boolean()) })) },
  returns: v.null(),
  handler: async (ctx, { redemptionId, messages }) => {
    const redemption = await ctx.db.get(redemptionId);
    if (!redemption || messages.length === 0) return null;
    await ctx.db.patch(redemptionId, { adminMessages: [...(redemption.adminMessages ?? []), ...messages].slice(-MAX_ADMIN_DMS) });
    if (redemption.status !== "pending") await ctx.scheduler.runAfter(0, internal.slack.syncAdminMessages, { redemptionId });
    return null;
  },
});

/** A redemption's latest state and every admin copy of its review DM, or null if Slack can't be told. */
export const adminCopies = internalQuery({
  args: { redemptionId: v.id("redemptions") },
  returns: v.union(
    v.null(),
    v.object({
      slackTeamId: v.string(),
      botToken: v.string(),
      emojiName: v.string(),
      version: v.string(),
      status: redemptionStatusValidator,
      requester: v.object({ slackUserId: v.string(), name: v.string() }),
      // legacy: a request from the received-kudos Store (ADR 0001), priced in kudos; a refund gives back no coins.
      reward: v.object({ name: v.string(), emoji: v.string(), cost: v.number(), legacy: v.boolean() }),
      prompt: v.optional(v.string()),
      answer: v.optional(v.string()),
      step: v.object({ at: v.number(), bySlackUserId: v.union(v.string(), v.null()), note: v.optional(v.string()) }),
      messages: v.array(v.object({ channel: v.string(), ts: v.string(), own: v.optional(v.boolean()) })),
    }),
  ),
  handler: async (ctx, { redemptionId }) => {
    const redemption = await ctx.db.get(redemptionId);
    if (!redemption?.adminMessages?.length) return null;
    const workspace = await ctx.db.get(redemption.workspaceId);
    if (!workspace || workspace.status !== "active" || workspace.isDemo) return null;
    const install = await ctx.db
      .query("slackInstallations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .unique();
    const requester = await ctx.db.get(redemption.memberId);
    if (!install || !requester) return null;
    const last = redemption.history[redemption.history.length - 1];
    return {
      slackTeamId: workspace.slackTeamId,
      botToken: install.botToken,
      emojiName: workspace.emojiName,
      // Changes with every step and every newly saved copy, so a sync can tell it went stale.
      version: `${redemption.history.length}:${redemption.adminMessages.length}:${redemption.adminMessages.at(-1)!.ts}`,
      status: redemption.status,
      requester: { slackUserId: requester.slackUserId, name: requester.name },
      reward: { name: redemption.rewardName, emoji: redemption.rewardEmoji, cost: redemption.cost, legacy: redemption.unit !== "coins" },
      prompt: redemption.prompt,
      answer: redemption.answer,
      step: { at: last.at, bySlackUserId: (await ctx.db.get(last.by))?.slackUserId ?? null, ...(last.note ? { note: last.note } : {}) },
      messages: redemption.adminMessages,
    };
  },
});

/**
 * Approve or Mark fulfilled, clicked in an admin's review DM. Nothing in the payload is taken on
 * trust: the team must be an installed workspace, the Slack user an active admin of it, and the
 * request one of its own. The store helper then applies the lifecycle and the four-eyes rule,
 * so a retried or stale click changes nothing. Returns null on success, else what to tell them.
 */
export const storeInteraction = internalMutation({
  args: {
    teamId: v.string(),
    slackUserId: v.string(),
    userTeamId: v.optional(v.string()),
    action: v.union(v.literal("approve"), v.literal("fulfill")),
    redemptionId: v.string(),
  },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_team", (q) => q.eq("slackTeamId", args.teamId))
      .unique();
    if (!workspace || workspace.status !== "active" || workspace.isDemo) return "Kudos isn't installed in this workspace yet.";
    // Someone from another team (e.g. over Slack Connect) is never one of this workspace's admins.
    const member =
      args.userTeamId && args.userTeamId !== args.teamId
        ? null
        : await ctx.db
            .query("members")
            .withIndex("by_workspace_slackUser", (q) => q.eq("workspaceId", workspace._id).eq("slackUserId", args.slackUserId))
            .unique();
    if (!member || !member.isAdmin || member.deactivated || member.isBot) return "Only workspace admins can do that.";
    // The four-eyes rule only counts admins who have signed in (`otherActiveAdminExists`), so only they decide.
    if (!member.userId) return "Sign in to Kudos once before you decide requests from Slack.";
    const id = ctx.db.normalizeId("redemptions", args.redemptionId);
    const redemption = id ? await ctx.db.get(id) : null;
    if (!redemption || redemption.workspaceId !== workspace._id) return "Request not found.";
    try {
      // Every check runs before the first write, so a refusal leaves nothing behind.
      await transitionRedemption(ctx, { workspace, redemption, actor: member, action: args.action, now: Date.now() });
      return null;
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") return error.data;
      throw error;
    }
  },
});
