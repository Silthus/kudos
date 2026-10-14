import { v, type Infer } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { messageRefValidator, type MessageRef } from "../engine/messageEvent";
import type { MemberId } from "../workspace/directory";

export const rewardRecordValidator = v.object({
  member: v.id("members"),
  key: v.string(),
  xp: v.number(),
  coins: v.number(),
  item: v.null(),
  catalogueVersion: v.string(),
  at: v.number(),
  cause: v.optional(messageRefValidator),
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
