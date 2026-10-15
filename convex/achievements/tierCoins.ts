import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { recordReward } from "../progression/progression";
import { chatUserOf } from "../workspace/directory";
import { coinRewardsOf } from "./ladders";
import { tierRewardKeyOf } from "./tierRewards";
import { earnedTiersPage, type EarnedTier } from "./tiers";

export type TierCoinsBackfilled = { tiers: number; paid: number };

type PaidPage = TierCoinsBackfilled & { isDone: boolean; continueCursor: string };

type PayingTier = Pick<EarnedTier, "member" | "tier" | "rewards" | "catalogueVersion">;

const tiersPerPage = 25;

export async function payTierCoins(ctx: MutationCtx, workspace: string, earned: PayingTier, at: number): Promise<number> {
  let paid = 0;
  for (const { reward, coins } of coinRewardsOf(earned)) {
    const record = { member: earned.member, key: tierRewardKeyOf(reward), xp: 0, coins, item: null, catalogueVersion: earned.catalogueVersion, at };
    if ((await recordReward(ctx, workspace, record)) === "recorded") paid += 1;
  }
  return paid;
}

export const backfillTierCoins = observedAction({
  args: {},
  handler: async (ctx): Promise<TierCoinsBackfilled> => {
    const totals: TierCoinsBackfilled = { tiers: 0, paid: 0 };
    let cursor: string | null = null;
    while (true) {
      const page: PaidPage = await ctx.runMutation(internal.achievements.tierCoins.payTierCoinsPage, { cursor });
      totals.tiers += page.tiers;
      totals.paid += page.paid;
      if (page.isDone) return totals;
      cursor = page.continueCursor;
    }
  },
});

export const payTierCoinsPage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }): Promise<PaidPage> => {
    const { page, isDone, continueCursor } = await earnedTiersPage(ctx, cursor, tiersPerPage);
    const ranAt = Date.now();
    let paid = 0;
    for (const earned of page) paid += await payTierCoins(ctx, (await chatUserOf(ctx, earned.member)).workspace, earned, ranAt);
    return { tiers: page.length, paid, isDone, continueCursor };
  },
});
