import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { recordReward } from "../progression/progression";
import { tierItemOf, type ItemId } from "../store/catalogue";
import { grantItem } from "../store/inventory";
import { chatUserOf } from "../workspace/directory";
import { tierRewardKeyOf } from "./tierRewards";
import { earnedTiersPage, type EarnedTier } from "./tiers";

export type TierEmojiBackfilled = { tiers: number; granted: number };

type GrantedPage = TierEmojiBackfilled & { isDone: boolean; continueCursor: string };

type GrantingTier = Pick<EarnedTier, "member" | "ladder" | "rewards" | "catalogueVersion">;

const tiersPerPage = 25;

export async function grantTierEmoji(ctx: MutationCtx, workspace: string, earned: GrantingTier, at: number): Promise<number> {
  const { member, catalogueVersion } = earned;
  let granted = 0;
  for (const { reward, item } of kudosEmojiRewardsOf(earned)) {
    const record = { member, key: tierRewardKeyOf(reward), xp: 0, coins: 0, item, catalogueVersion, at };
    if ((await recordReward(ctx, workspace, record)) === "already recorded") continue;
    await grantItem(ctx, { member, item, source: "tier", arrivedAt: at });
    granted += 1;
  }
  return granted;
}

export const backfillTierEmoji = observedAction({
  args: {},
  handler: async (ctx): Promise<TierEmojiBackfilled> => {
    const totals: TierEmojiBackfilled = { tiers: 0, granted: 0 };
    let cursor: string | null = null;
    while (true) {
      const page: GrantedPage = await ctx.runMutation(internal.achievements.tierEmoji.grantTierEmojiPage, { cursor });
      totals.tiers += page.tiers;
      totals.granted += page.granted;
      if (page.isDone) return totals;
      cursor = page.continueCursor;
    }
  },
});

export const grantTierEmojiPage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }): Promise<GrantedPage> => {
    const { page, isDone, continueCursor } = await earnedTiersPage(ctx, cursor, tiersPerPage);
    const ranAt = Date.now();
    let granted = 0;
    for (const earned of page) granted += await grantTierEmoji(ctx, (await chatUserOf(ctx, earned.member)).workspace, earned, ranAt);
    return { tiers: page.length, granted, isDone, continueCursor };
  },
});

function kudosEmojiRewardsOf({ ladder, rewards }: Pick<GrantingTier, "ladder" | "rewards">): Array<{ reward: string; item: ItemId }> {
  return rewards.filter(({ kind }) => kind === "kudosEmoji").map(({ reward }) => ({ reward, item: tierItemOf(ladder).item }));
}
