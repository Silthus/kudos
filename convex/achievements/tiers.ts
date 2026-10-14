import { v, type Infer } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import { awardIdValidator, type AwardId } from "../engine/awards";
import type { MemberId } from "../workspace/directory";
import type { BatchId } from "./replay";
import { ladders, ladderValidator, promisedRewardValidator, tierValidator, type LadderId, type Tier, type TierId } from "./ladders";

export const earnedTierValidator = v.object({
  member: v.id("members"),
  ladder: ladderValidator,
  tier: tierValidator,
  earnedAt: v.number(),
  award: awardIdValidator,
  catalogueVersion: v.string(),
  rewards: v.array(promisedRewardValidator),
  batch: v.optional(v.id("bookBatches")),
});

export type EarnedTier = Infer<typeof earnedTierValidator>;

export type Reaching = { workspace: string; member: MemberId; ladder: LadderId; award: AwardId; at: number; batch?: BatchId };

export async function earnTier(ctx: MutationCtx, { workspace, member, ladder, award, at, batch }: Reaching, { tier, rewards }: Tier) {
  if ((await earnedTierOf(ctx, member, ladder, tier)) !== null) return;
  await ctx.db.insert("earnedTiers", { member, ladder, tier, earnedAt: at, award, catalogueVersion: ladders.version, rewards, batch });
  await publish(ctx, { type: "achievementEarned", workspace, member, ladder, tier, at, batch });
}

export function earnedTiersOf(ctx: QueryCtx, member: MemberId, ladder: LadderId): Promise<EarnedTier[]> {
  return ctx.db
    .query("earnedTiers")
    .withIndex("by_member_ladder_tier", (q) => q.eq("member", member).eq("ladder", ladder))
    .collect();
}

function earnedTierOf(ctx: QueryCtx, member: MemberId, ladder: LadderId, tier: TierId) {
  return ctx.db
    .query("earnedTiers")
    .withIndex("by_member_ladder_tier", (q) => q.eq("member", member).eq("ladder", ladder).eq("tier", tier))
    .unique();
}
