import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { rewardsPage, type RewardRecord } from "../progression/rewards";
import { belongsInTheFinishRecord, recordQuestFinish, type QuestFinish } from "./finishes";

export const seedQuestFinishes = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), numItems: v.number() },
  handler: async (ctx, { cursor, numItems }) => {
    const { page, isDone, continueCursor } = await rewardsPage(ctx, cursor, numItems);
    let seeded = 0;
    for (const reward of page.filter(belongsInTheFinishRecord)) if ((await recordQuestFinish(ctx, finishOf(reward))) === "recorded") seeded += 1;
    return { seeded, cursor: continueCursor, isDone };
  },
});

function finishOf({ member, key, xp, catalogueVersion, at, cause }: RewardRecord): QuestFinish {
  return { member, key, xp, catalogueVersion, at, ...(cause && { cause }) };
}
