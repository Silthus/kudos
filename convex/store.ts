import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireViewer } from "./lib/access";
import { balanceOf, MAX_ACTIVE_REWARDS, MAX_OPEN_REDEMPTIONS, storeOpen } from "./lib/store";

/**
 * The Rewards Store for members. Like `engine.ts` for kudos, this module is the one
 * place balances, stock and redemptions change (redeeming arrives in the next slice).
 */

/** Active rewards, cheapest first. Reads one more than the cap so callers can detect a full catalog. */
export async function activeRewards(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  return await ctx.db
    .query("rewards")
    .withIndex("by_workspace_status_cost", (q) => q.eq("workspaceId", workspaceId).eq("status", "active"))
    .take(MAX_ACTIVE_REWARDS + 1);
}

const catalogReward = v.object({
  _id: v.id("rewards"),
  name: v.string(),
  description: v.optional(v.string()),
  emoji: v.string(),
  cost: v.number(),
  stock: v.optional(v.number()),
  maxPerMember: v.optional(v.number()),
  prompt: v.optional(v.string()),
  yourCount: v.number(),
  affordable: v.boolean(),
  soldOut: v.boolean(),
  limitReached: v.boolean(),
});

/** What the signed-in member can spend and what's on the shelves. The balance is theirs alone. */
export const catalog = query({
  args: {},
  returns: v.union(
    v.object({ enabled: v.literal(false) }),
    v.object({
      enabled: v.literal(true),
      balance: v.number(),
      openCount: v.number(),
      maxOpen: v.number(),
      rewards: v.array(catalogReward),
    }),
  ),
  handler: async (ctx) => {
    const { workspace, member } = await requireViewer(ctx);
    if (!storeOpen(workspace)) return { enabled: false as const };
    const balance = balanceOf(member);
    const rewards = (await activeRewards(ctx, workspace._id)).slice(0, MAX_ACTIVE_REWARDS);
    return {
      enabled: true as const,
      balance,
      openCount: 0, // redemptions arrive with the next slice
      maxOpen: MAX_OPEN_REDEMPTIONS,
      rewards: rewards.map((r) => {
        const yourCount = 0; // counted from redemptions once redeeming ships
        return {
          _id: r._id,
          name: r.name,
          description: r.description,
          emoji: r.emoji,
          cost: r.cost,
          stock: r.stock,
          maxPerMember: r.maxPerMember,
          prompt: r.prompt,
          yourCount,
          affordable: balance >= r.cost,
          soldOut: r.stock !== undefined && r.stock <= 0,
          limitReached: r.maxPerMember !== undefined && yourCount >= r.maxPerMember,
        };
      }),
    };
  },
});
