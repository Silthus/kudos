import { v, type Infer } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const rewardRecordValidator = v.object({
  member: v.id("members"),
  key: v.string(),
  xp: v.number(),
  coins: v.number(),
  item: v.null(),
  catalogueVersion: v.string(),
  at: v.number(),
});

export type RewardRecord = Infer<typeof rewardRecordValidator>;

export async function insertReward(ctx: MutationCtx, reward: RewardRecord) {
  await ctx.db.insert("rewardRecords", reward);
}

export function rewardOf(ctx: QueryCtx, member: MemberId, key: string) {
  return ctx.db
    .query("rewardRecords")
    .withIndex("by_member_key", (q) => q.eq("member", member).eq("key", key))
    .unique();
}
