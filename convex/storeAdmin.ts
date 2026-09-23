import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { assertNotDemo, requireAdmin } from "./lib/access";
import { median, workspaceMembers } from "./lib/stats";
import { assertValidStock, balanceOf, MAX_ACTIVE_REWARDS, validateRewardInput } from "./lib/store";
import { activeRewards } from "./store";

/** Admin side of the Rewards Store: opening it and stocking the catalog. */

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
  }),
  handler: async (ctx) => {
    const { workspace } = await requireAdmin(ctx);
    const active = await activeRewards(ctx, workspace._id);
    const base = {
      enabled: Boolean(workspace.storeEnabled),
      receivedVisibility: workspace.receivedVisibility,
      activeRewards: Math.min(active.length, MAX_ACTIVE_REWARDS),
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
