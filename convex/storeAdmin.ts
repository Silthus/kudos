import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { assertNotDemo, requireAdmin } from "./lib/access";
import { median, workspaceMembers } from "./lib/stats";
import { DAY_MS, dayKeyFor } from "./lib/time";
import { coinBalance } from "./lib/coins";
import {
  assertValidStock,
  concentration,
  CONTEXT_READ_CAP,
  CONTEXT_WINDOW_DAYS,
  MAX_ACTIVE_REWARDS,
  OPEN_COUNT_CAP,
  validateRewardInput,
} from "./lib/store";
import { redemptionStatusValidator } from "./schema";
import { gameOn, playerOf } from "./game";
import {
  activeRewards,
  pricedInCoins,
  adjustmentRow,
  adjustmentValidator,
  coinWallet,
  grantBalance,
  historyEntryValidator,
  ownDecisionBlocker,
  peopleCache,
  personValidator,
  redemptionInWorkspace,
  transitionRedemption,
} from "./store";

/**
 * Admin side of the Store (#91, ADR 0002): the real-rewards switch, stocking the catalog, deciding
 * on requests and adjusting Hog coins. Game items need no admin: they apply instantly.
 */

const rewardFields = v.object({
  name: v.string(),
  emoji: v.string(),
  cost: v.number(),
  description: v.optional(v.string()),
  stock: v.optional(v.number()),
  maxPerMember: v.optional(v.number()),
  prompt: v.optional(v.string()),
});

const rewardStatusValidator = v.union(v.literal("active"), v.literal("archived"));

const rewardRow = v.object({
  _id: v.id("rewards"),
  name: v.string(),
  emoji: v.string(),
  cost: v.number(),
  description: v.optional(v.string()),
  stock: v.optional(v.number()),
  maxPerMember: v.optional(v.number()),
  prompt: v.optional(v.string()),
  status: rewardStatusValidator,
  updatedAt: v.number(),
  openCount: v.number(),
  fulfilledCount: v.number(),
  // Priced before the Store moved to Hog coins: off the shelves until an admin re-saves it.
  pricedInKudos: v.boolean(),
});

const CATALOG_READ_ONLY = "The store catalog is";

export const overview = query({
  args: {},
  returns: v.object({
    // The real-rewards switch as set; real rewards only show while the game is on too.
    enabled: v.boolean(),
    gameEnabled: v.boolean(),
    // Hog coins across active members, for pricing; null while the game is off (no currency).
    totalBalance: v.union(v.number(), v.null()),
    medianBalance: v.union(v.number(), v.null()),
    activeRewards: v.number(),
    // Active rewards still priced in received kudos: members don't see them until re-saved.
    unpricedRewards: v.number(),
    openCount: v.number(),
  }),
  handler: async (ctx) => {
    const { workspace } = await requireAdmin(ctx);
    const active = (await activeRewards(ctx, workspace._id)).slice(0, MAX_ACTIVE_REWARDS);
    const base = {
      enabled: workspace.realRewardsEnabled === true,
      gameEnabled: gameOn(workspace),
      activeRewards: active.length,
      unpricedRewards: active.filter((r) => !pricedInCoins(r)).length,
      openCount: await openRequestCount(ctx, workspace._id),
    };
    if (!base.gameEnabled) return { ...base, totalBalance: null, medianBalance: null };
    const members = (await workspaceMembers(ctx, workspace._id)).filter((m) => !m.deactivated);
    const balances = await Promise.all(members.map(async (m) => coinBalance((await playerOf(ctx, m._id)) ?? { level: 1 }, m).balance));
    return { ...base, totalBalance: balances.reduce((a, b) => a + b, 0), medianBalance: median(balances) };
  },
});

/**
 * The real-rewards switch (off by default): the catalog and request → approve → fulfil, priced in
 * Hog coins. Open requests stay decidable while it's off.
 */
export const setRealRewardsEnabled = mutation({
  args: { enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { enabled }) => {
    const { workspace } = await requireAdmin(ctx);
    assertNotDemo(workspace, "Store settings are");
    await ctx.db.patch(workspace._id, { realRewardsEnabled: enabled || undefined });
    return null;
  },
});

/** Every reward, active ones first, each group cheapest first. */
export const rewards = query({
  args: {},
  returns: v.array(rewardRow),
  handler: async (ctx) => {
    const { workspace } = await requireAdmin(ctx);
    const active = await activeRewards(ctx, workspace._id);
    const archived = await ctx.db
      .query("rewards")
      .withIndex("by_workspace_status_cost", (q) => q.eq("workspaceId", workspace._id).eq("status", "archived"))
      .take(500);
    return [...active, ...archived].map((r) => ({
      _id: r._id,
      name: r.name,
      emoji: r.emoji,
      cost: r.cost,
      description: r.description,
      stock: r.stock,
      maxPerMember: r.maxPerMember,
      prompt: r.prompt,
      status: r.status,
      updatedAt: r.updatedAt,
      openCount: r.openCount ?? 0,
      fulfilledCount: r.fulfilledCount ?? 0,
      pricedInKudos: !pricedInCoins(r),
    }));
  },
});

export const createReward = mutation({
  args: rewardFields.fields,
  returns: v.id("rewards"),
  handler: async (ctx, args) => {
    const { workspace, member } = await requireAdmin(ctx);
    assertNotDemo(workspace, CATALOG_READ_ONLY);
    const reward = validateRewardInput(args);
    await assertRoomForActive(ctx, workspace._id);
    return await ctx.db.insert("rewards", {
      workspaceId: workspace._id,
      ...reward,
      unit: "coins",
      status: "active",
      createdBy: member._id,
      updatedAt: Date.now(),
    });
  },
});

const stockValue = v.union(v.number(), v.literal("unlimited"));
const fromStockValue = (s: number | "unlimited") => (s === "unlimited" ? undefined : s);

/**
 * Replaces every descriptive field; an omitted optional field is cleared. Stock is live
 * (redemptions move it), so it only changes through an explicit `stock: { from, to }` that
 * is refused when the stock moved since the editor opened. Redemptions keep their own snapshot.
 */
export const updateReward = mutation({
  args: {
    rewardId: v.id("rewards"),
    ...rewardFields.omit("stock").fields,
    stock: v.optional(v.object({ from: stockValue, to: stockValue })),
  },
  returns: v.null(),
  handler: async (ctx, { rewardId, stock, ...args }) => {
    const { workspace } = await requireAdmin(ctx);
    assertNotDemo(workspace, CATALOG_READ_ONLY);
    const reward = await rewardInWorkspace(ctx, workspace, rewardId);
    const { stock: _unused, ...fields } = validateRewardInput(args);
    // Saving a price is what prices a reward from the received-kudos Store in Hog coins.
    const patch: Partial<Doc<"rewards">> = { ...fields, unit: "coins", updatedAt: Date.now() };
    if (stock) {
      if (fromStockValue(stock.from) !== reward.stock) {
        throw new ConvexError(`Stock changed while you were editing (now ${reward.stock ?? "unlimited"}). Take another look.`);
      }
      patch.stock = fromStockValue(stock.to);
      assertValidStock(patch.stock);
    }
    await ctx.db.patch(rewardId, patch);
    return null;
  },
});

/** Archive or restore. Rewards are never deleted, so redemptions can link back to them. */
export const setRewardStatus = mutation({
  args: { rewardId: v.id("rewards"), status: rewardStatusValidator },
  returns: v.null(),
  handler: async (ctx, { rewardId, status }) => {
    const { workspace } = await requireAdmin(ctx);
    assertNotDemo(workspace, CATALOG_READ_ONLY);
    const reward = await rewardInWorkspace(ctx, workspace, rewardId);
    if (reward.status === status) return null;
    if (status === "active") await assertRoomForActive(ctx, workspace._id);
    await ctx.db.patch(rewardId, { status, updatedAt: Date.now() });
    return null;
  },
});

async function assertRoomForActive(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  if ((await activeRewards(ctx, workspaceId)).length >= MAX_ACTIVE_REWARDS) {
    throw new ConvexError(`The store holds up to ${MAX_ACTIVE_REWARDS} active rewards. Archive one first.`);
  }
}

async function rewardInWorkspace(ctx: MutationCtx, workspace: Doc<"workspaces">, rewardId: Id<"rewards">) {
  const reward = await ctx.db.get(rewardId);
  if (!reward || reward.workspaceId !== workspace._id) throw new ConvexError("Reward not found.");
  return reward;
}

// ── Requests ─────────────────────────────────────────────────────────────────

export { OPEN_COUNT_CAP };

export async function openRequestCount(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const rows = await ctx.db
    .query("redemptions")
    .withIndex("by_workspace_isOpen_requestedAt", (q) => q.eq("workspaceId", workspaceId).eq("isOpen", true))
    .take(OPEN_COUNT_CAP);
  return rows.length;
}

/** Open requests waiting on an admin, for the badge on the Admin nav item (capped at 100). */
export const openCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const { workspace } = await requireAdmin(ctx);
    return await openRequestCount(ctx, workspace._id);
  },
});

const queueRow = v.object({
  _id: v.id("redemptions"),
  requester: v.object({ ...personValidator.fields, deactivated: v.boolean() }),
  rewardId: v.id("rewards"),
  rewardName: v.string(),
  rewardEmoji: v.string(),
  cost: v.number(),
  prompt: v.optional(v.string()),
  answer: v.optional(v.string()),
  status: redemptionStatusValidator,
  adminNote: v.optional(v.string()),
  requestedAt: v.number(),
  updatedAt: v.number(),
  // The requester's Hog coins right now; null for someone whose record is gone.
  balance: v.union(v.number(), v.null()),
  negativeBalance: v.union(v.boolean(), v.null()),
  isOwn: v.boolean(),
  canDecide: v.boolean(), // false for your own request while another admin can decide (four-eyes)
  history: v.array(historyEntryValidator),
  // Made in the received-kudos Store: its cost was kudos, and declining it gives back no coins.
  legacy: v.boolean(),
});

/**
 * The request queue. "open" merges pending and approved requests oldest first, so the
 * queue is first come, first served; the finished filters list the newest first.
 */
export const redemptions = query({
  args: {
    filter: v.union(v.literal("open"), v.literal("fulfilled"), v.literal("declined"), v.literal("cancelled")),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(queueRow),
  handler: async (ctx, { filter, paginationOpts }) => {
    const { workspace, member: me } = await requireAdmin(ctx);
    const result =
      filter === "open"
        ? await ctx.db
            .query("redemptions")
            .withIndex("by_workspace_isOpen_requestedAt", (q) => q.eq("workspaceId", workspace._id).eq("isOpen", true))
            .order("asc")
            .paginate(paginationOpts)
        : await ctx.db
            .query("redemptions")
            .withIndex("by_workspace_status_requestedAt", (q) => q.eq("workspaceId", workspace._id).eq("status", filter))
            .order("desc")
            .paginate(paginationOpts);
    const people = peopleCache(ctx);
    const soleAdmin = (await ownDecisionBlocker(ctx, workspace, me)) === null;
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (r) => {
          const requester = await people.member(r.memberId);
          const balance = requester ? coinBalance((await playerOf(ctx, requester._id)) ?? { level: 1 }, requester).balance : null;
          const isOwn = r.memberId === me._id;
          return {
            _id: r._id,
            requester: {
              _id: r.memberId,
              name: requester?.name ?? "Unknown member",
              avatarUrl: requester?.avatarUrl ?? null,
              deactivated: requester?.deactivated ?? true,
            },
            rewardId: r.rewardId,
            rewardName: r.rewardName,
            rewardEmoji: r.rewardEmoji,
            cost: r.cost,
            prompt: r.prompt,
            answer: r.answer,
            status: r.status,
            adminNote: r.adminNote,
            requestedAt: r.requestedAt,
            updatedAt: r.updatedAt,
            balance,
            negativeBalance: balance === null ? null : balance < 0,
            isOwn,
            canDecide: r.isOpen && (!isOwn || soleAdmin),
            history: await people.history(r),
            legacy: r.unit !== "coins",
          };
        }),
      ),
    };
  },
});

// ── Balance adjustments and review aids (S6) ─────────────────────────────────

/** A member of the admin's workspace (not a bot), or "not found" so ids can't be probed. */
async function memberInWorkspace(ctx: QueryCtx, workspace: Doc<"workspaces">, memberId: Id<"members">) {
  const member = await ctx.db.get(memberId);
  if (!member || member.workspaceId !== workspace._id || member.isBot) throw new ConvexError("Member not found.");
  return member;
}

/**
 * Corrects someone's Hog coins by hand, with a reason they'll see. Never your own: a self-grant
 * is the most obvious abuse, so it's refused even for a sole admin. Coins only exist while the
 * game is on; in the shared demo they're read-only like the catalog.
 */
export const adjustBalance = mutation({
  args: { memberId: v.id("members"), amount: v.number(), reason: v.string() },
  returns: v.object({ balance: v.number() }),
  handler: async (ctx, { memberId, amount, reason }) => {
    const { workspace, member: me } = await requireAdmin(ctx);
    assertNotDemo(workspace, "Balances are");
    if (!gameOn(workspace)) throw new ConvexError("Hog coins only exist while the game is on. Switch it on first.");
    const member = await memberInWorkspace(ctx, workspace, memberId);
    if (member._id === me._id) throw new ConvexError("You can't adjust your own balance. Ask another admin.");
    const { balance } = await grantBalance(ctx, { workspace, member, amount, reason, source: "admin", by: me, now: Date.now() });
    return { balance };
  },
});

const LEDGER_ROWS = 20;

/**
 * Where a member's Hog coins stand: from thoughtful kudos + from quests + from level-ups + adjustments − spent
 * (lib/coins.ts), with the latest adjustments and requests. null while the game is off: then
 * there is no currency.
 */
export const memberLedger = query({
  args: { memberId: v.id("members") },
  returns: v.union(
    v.null(),
    v.object({
      member: v.object({ ...personValidator.fields, deactivated: v.boolean(), isYou: v.boolean() }),
      fromKudos: v.number(),
      fromQuests: v.number(),
      fromLevels: v.number(),
      adjusted: v.number(),
      spent: v.number(),
      balance: v.number(),
      adjustments: v.array(adjustmentValidator),
      redemptions: v.array(
        v.object({
          _id: v.id("redemptions"),
          rewardName: v.string(),
          rewardEmoji: v.string(),
          cost: v.number(),
          status: redemptionStatusValidator,
          requestedAt: v.number(),
          legacy: v.boolean(), // from the received-kudos Store: the cost was kudos, not coins
        }),
      ),
    }),
  ),
  handler: async (ctx, { memberId }) => {
    const { workspace, member: me } = await requireAdmin(ctx);
    const member = await memberInWorkspace(ctx, workspace, memberId);
    if (!gameOn(workspace)) return null;
    const { coins } = await coinWallet(ctx, member._id);
    const adjustments = await ctx.db
      .query("balanceAdjustments")
      .withIndex("by_member_unit_at", (q) => q.eq("memberId", member._id).eq("unit", "coins"))
      .order("desc")
      .take(LEDGER_ROWS);
    const redemptions = await ctx.db
      .query("redemptions")
      .withIndex("by_member_requestedAt", (q) => q.eq("memberId", member._id))
      .order("desc")
      .take(LEDGER_ROWS);
    const people = peopleCache(ctx);
    return {
      member: { _id: member._id, name: member.name, avatarUrl: member.avatarUrl ?? null, deactivated: member.deactivated, isYou: member._id === me._id },
      fromKudos: coins.fromKudos,
      fromQuests: coins.fromQuests,
      fromLevels: coins.fromLevels,
      adjusted: coins.adjusted,
      spent: coins.spent,
      balance: coins.balance,
      adjustments: await Promise.all(adjustments.map((a) => adjustmentRow(people, a))),
      redemptions: redemptions.map((r) => ({
        _id: r._id,
        rewardName: r.rewardName,
        rewardEmoji: r.rewardEmoji,
        cost: r.cost,
        status: r.status,
        requestedAt: r.requestedAt,
        legacy: r.unit !== "coins",
      })),
    };
  },
});

/**
 * "Where these coins came from": whom the requester thanked with the thoughtful kudos that earned
 * their Hog coins in the 90 days before the request, top 3 first, with a flag when one person
 * brought most of them (a hint of two people trading thoughtful kudos for coins). It reads the
 * requester's own game ledger, so it only shows their giving, which is never private. The window
 * ends at the request, so the answer doesn't drift with the clock.
 */
export const redemptionContext = query({
  args: { redemptionId: v.id("redemptions") },
  returns: v.object({
    windowDays: v.number(),
    total: v.number(), // coins from thoughtful kudos in the window
    thanked: v.array(v.object({ member: v.object({ ...personValidator.fields, deactivated: v.boolean() }), amount: v.number(), share: v.number() })),
    otherThanked: v.number(), // people beyond the top 3
    concentrated: v.boolean(),
    truncated: v.boolean(), // more than CONTEXT_READ_CAP ledger events: summarised from the newest
  }),
  handler: async (ctx, { redemptionId }) => {
    const { workspace } = await requireAdmin(ctx);
    const redemption = await redemptionInWorkspace(ctx, workspace, redemptionId);
    const to = redemption.requestedAt;
    const tz = workspace.timezone;
    const events = await ctx.db
      .query("gameEvents")
      .withIndex("by_member_day", (q) =>
        q.eq("memberId", redemption.memberId).gte("dayKey", dayKeyFor(to - CONTEXT_WINDOW_DAYS * DAY_MS, tz)).lte("dayKey", dayKeyFor(to, tz)),
      )
      .order("desc")
      .take(CONTEXT_READ_CAP + 1);
    const truncated = events.length > CONTEXT_READ_CAP;
    const byReceiver = new Map<Id<"members">, number>();
    for (const e of events.slice(0, CONTEXT_READ_CAP)) {
      if (e.kind !== "give" || e.at > to || e.at < to - CONTEXT_WINDOW_DAYS * DAY_MS) continue;
      for (const line of e.lines ?? []) {
        if (line.coins) byReceiver.set(line.receiverId, (byReceiver.get(line.receiverId) ?? 0) + line.coins);
      }
    }
    const ranked = [...byReceiver].map(([receiverId, amount]) => ({ receiverId, amount })).sort((a, b) => b.amount - a.amount);
    const total = ranked.reduce((sum, g) => sum + g.amount, 0);
    const people = peopleCache(ctx);
    const top = ranked.slice(0, 3);
    return {
      windowDays: CONTEXT_WINDOW_DAYS,
      total,
      thanked: await Promise.all(
        top.map(async ({ receiverId, amount }) => {
          const m = await people.member(receiverId);
          return {
            member: { _id: receiverId, name: m?.name ?? "Unknown member", avatarUrl: m?.avatarUrl ?? null, deactivated: m?.deactivated ?? true },
            amount,
            share: amount / total,
          };
        }),
      ),
      otherThanked: ranked.length - top.length,
      concentrated: concentration(ranked),
      truncated,
    };
  },
});

/**
 * Approve, fulfil or decline a request. Allowed in the demo (like revoking kudos): the
 * queue is meant to be played with; only the catalog and store settings are read-only.
 */
export const decide = mutation({
  args: {
    redemptionId: v.id("redemptions"),
    action: v.union(v.literal("approve"), v.literal("fulfill"), v.literal("decline")),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { redemptionId, action, note }) => {
    const { workspace, member } = await requireAdmin(ctx);
    const redemption = await redemptionInWorkspace(ctx, workspace, redemptionId);
    await transitionRedemption(ctx, { workspace, redemption, actor: member, action, note, now: Date.now() });
    return null;
  },
});
