import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { assertNotDemo, requireAdmin } from "./lib/access";
import { median, workspaceMembers } from "./lib/stats";
import { assertValidStock, balanceOf, MAX_ACTIVE_REWARDS, validateRewardInput } from "./lib/store";
import { redemptionStatusValidator } from "./schema";
import {
  activeRewards,
  historyEntryValidator,
  otherActiveAdminExists,
  peopleCache,
  personValidator,
  redemptionInWorkspace,
  transitionRedemption,
} from "./store";

/** Admin side of the Rewards Store: opening it, stocking the catalog and deciding on requests. */

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
});

const CATALOG_READ_ONLY = "The store catalog is";

export const overview = query({
  args: {},
  returns: v.object({
    enabled: v.boolean(),
    receivedVisibility: v.union(v.literal("hidden"), v.literal("self"), v.literal("everyone")),
    // null while received kudos are hidden: balances are received counts in disguise.
    totalBalance: v.union(v.number(), v.null()),
    medianBalance: v.union(v.number(), v.null()),
    activeRewards: v.number(),
    openCount: v.number(),
  }),
  handler: async (ctx) => {
    const { workspace } = await requireAdmin(ctx);
    const active = await activeRewards(ctx, workspace._id);
    const base = {
      enabled: Boolean(workspace.storeEnabled),
      receivedVisibility: workspace.receivedVisibility,
      activeRewards: Math.min(active.length, MAX_ACTIVE_REWARDS),
      openCount: await openRequestCount(ctx, workspace._id),
    };
    if (workspace.receivedVisibility === "hidden") return { ...base, totalBalance: null, medianBalance: null };
    const members = await workspaceMembers(ctx, workspace._id);
    const balances = members.filter((m) => !m.deactivated).map(balanceOf);
    return { ...base, totalBalance: balances.reduce((a, b) => a + b, 0), medianBalance: median(balances) };
  },
});

export const setStoreEnabled = mutation({
  args: { enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { enabled }) => {
    const { workspace } = await requireAdmin(ctx);
    assertNotDemo(workspace, "Store settings are");
    if (enabled && workspace.receivedVisibility === "hidden") {
      throw new ConvexError("The store shows people what they received. Switch received visibility to “Only me” or “Everyone” first.");
    }
    await ctx.db.patch(workspace._id, { storeEnabled: enabled });
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
    const patch: Partial<Doc<"rewards">> = { ...fields, updatedAt: Date.now() };
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

/** Badges count up to this many open requests and show "99+" beyond. */
export const OPEN_COUNT_CAP = 100;

async function openRequestCount(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
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
  // null while received kudos are hidden: a balance is a received count in disguise.
  balance: v.union(v.number(), v.null()),
  negativeBalance: v.union(v.boolean(), v.null()),
  isOwn: v.boolean(),
  canDecide: v.boolean(), // false for your own request while another admin can decide (four-eyes)
  history: v.array(historyEntryValidator),
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
    const showBalance = workspace.receivedVisibility !== "hidden";
    const soleAdmin = !(await otherActiveAdminExists(ctx, workspace._id, me._id));
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (r) => {
          const requester = await people.member(r.memberId);
          const balance = requester && showBalance ? balanceOf(requester) : null;
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
          };
        }),
      ),
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
