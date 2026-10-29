import { v, type Infer } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { messageRefValidator, type MessageRef } from "../engine/messageEvent";
import type { MemberId } from "../workspace/directory";
import { journeyQuestOfRewardKey, weeklyQuestOfRewardKey } from "./crates";
import { isPaidOnTheMondayPath } from "./mondayCatalogue";

export const questFinishValidator = v.object({
  member: v.id("members"),
  key: v.string(),
  xp: v.number(),
  catalogueVersion: v.string(),
  at: v.number(),
  cause: v.optional(messageRefValidator),
});

export type QuestFinish = Infer<typeof questFinishValidator>;

export function questFinishOf(ctx: QueryCtx, member: MemberId, key: string) {
  return ctx.db
    .query("questFinishes")
    .withIndex("by_member_key", (q) => q.eq("member", member).eq("key", key))
    .unique();
}

export function questFinishesCausedBy(ctx: QueryCtx, member: MemberId, { workspace, conversation, message }: MessageRef) {
  return ctx.db
    .query("questFinishes")
    .withIndex("by_member_cause", (q) => q.eq("member", member).eq("cause.workspace", workspace).eq("cause.conversation", conversation).eq("cause.message", message))
    .collect();
}

export async function recordQuestFinish(ctx: MutationCtx, finish: QuestFinish): Promise<"recorded" | "already recorded"> {
  if ((await questFinishOf(ctx, finish.member, finish.key)) !== null) return "already recorded";
  await ctx.db.insert("questFinishes", finish);
  return "recorded";
}

export function belongsInTheFinishRecord({ key, catalogueVersion }: Pick<QuestFinish, "key" | "catalogueVersion">): boolean {
  return journeyQuestOfRewardKey(key) !== null || (isPaidOnTheMondayPath({ catalogueVersion }) && weeklyQuestOfRewardKey(key) !== null);
}
