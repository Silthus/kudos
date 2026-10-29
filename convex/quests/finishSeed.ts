import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { rewardsPage, type RewardRecord } from "../progression/rewards";
import { journeyQuestOfRewardKey, weeklyQuestOfRewardKey } from "./crates";
import { recordQuestFinish, type QuestFinish } from "./finishes";
import { isPaidOnTheMondayPath } from "./mondayCatalogue";

export const seedQuestFinishes = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), numItems: v.number() },
  handler: async (ctx, { cursor, numItems }) => {
    const { page, isDone, continueCursor } = await rewardsPage(ctx, cursor, numItems);
    let seeded = 0;
    for (const reward of page.filter(isAMondayPathFinish)) if ((await recordQuestFinish(ctx, finishOf(reward))) === "recorded") seeded += 1;
    return { seeded, cursor: continueCursor, isDone };
  },
});

function isAMondayPathFinish(reward: RewardRecord) {
  return isPaidOnTheMondayPath(reward) && (weeklyQuestOfRewardKey(reward.key) !== null || journeyQuestOfRewardKey(reward.key) !== null);
}

function finishOf({ member, key, xp, catalogueVersion, at, cause }: RewardRecord): QuestFinish {
  return { member, key, xp, catalogueVersion, at, ...(cause && { cause }) };
}
