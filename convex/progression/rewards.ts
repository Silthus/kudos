import { v, type Infer } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { messageRefValidator, type MessageRef } from "../engine/messageEvent";
import type { MemberId } from "../workspace/directory";

export const rewardRecordValidator = v.object({
  member: v.id("members"),
  key: v.string(),
  xp: v.number(),
  coins: v.number(),
  item: v.union(v.string(), v.null()),
  catalogueVersion: v.string(),
  at: v.number(),
  cause: v.optional(messageRefValidator),
  held: v.optional(v.literal(true)),
});

export type RewardRecord = Infer<typeof rewardRecordValidator>;

const standingWithCoinsValidator = v.object({ xp: v.number(), level: v.number(), coins: v.number(), skillPoints: v.number() });

export const appliedRewardValidator = v.object({ xp: v.number(), coins: v.number(), from: standingWithCoinsValidator, to: standingWithCoinsValidator });

export type AppliedReward = Infer<typeof appliedRewardValidator>;

export type StandingWithCoins = AppliedReward["from"];

export async function insertReward(ctx: MutationCtx, reward: RewardRecord) {
  await ctx.db.insert("rewardRecords", reward);
}

export function rewardOf(ctx: QueryCtx, member: MemberId, key: string) {
  return ctx.db
    .query("rewardRecords")
    .withIndex("by_member_key", (q) => q.eq("member", member).eq("key", key))
    .unique();
}

export function rewardsPage(ctx: QueryCtx, cursor: string | null, numItems: number) {
  return ctx.db.query("rewardRecords").paginate({ cursor, numItems });
}

export function rewardsKeyedFrom(ctx: QueryCtx, member: MemberId, keyPrefix: string) {
  return ctx.db
    .query("rewardRecords")
    .withIndex("by_member_key", (q) => q.eq("member", member).gte("key", keyPrefix).lt("key", `${keyPrefix}\uffff`))
    .collect();
}

export function rewardsCausedBy(ctx: QueryCtx, member: MemberId, { workspace, conversation, message }: MessageRef) {
  return ctx.db
    .query("rewardRecords")
    .withIndex("by_member_cause", (q) => q.eq("member", member).eq("cause.workspace", workspace).eq("cause.conversation", conversation).eq("cause.message", message))
    .collect();
}
