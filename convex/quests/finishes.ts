import { v, type Infer } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { messageRefValidator } from "../engine/messageEvent";
import type { MemberId } from "../workspace/directory";

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

export async function recordQuestFinish(ctx: MutationCtx, finish: QuestFinish): Promise<"recorded" | "already recorded"> {
  if ((await questFinishOf(ctx, finish.member, finish.key)) !== null) return "already recorded";
  await ctx.db.insert("questFinishes", finish);
  return "recorded";
}
