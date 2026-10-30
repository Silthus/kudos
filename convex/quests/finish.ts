import type { MutationCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import type { MessageRef } from "../engine/messageEvent";
import type { MemberId } from "../workspace/directory";
import { rewardKeyOf } from "./crates";
import { recordQuestFinish } from "./finishes";
import type { Reward } from "./journey";
import type { QuestId } from "./pool";
import type { Quest } from "./step";

export type PromisedReward = { reward: Reward; catalogueVersion: string; poolQuest?: QuestId };

export async function finishMondayQuest(ctx: MutationCtx, workspace: string, member: MemberId, quest: Quest, { reward, catalogueVersion, poolQuest }: PromisedReward, at: number, cause?: MessageRef): Promise<boolean> {
  const rewardKey = rewardKeyOf(quest);
  const recorded = await recordQuestFinish(ctx, { member, key: rewardKey, xp: reward.xp, catalogueVersion, at, ...(cause && { cause }) });
  if (recorded === "already recorded") return false;
  await publish(ctx, { type: "questFinished", workspace, member, quest, ...(poolQuest === undefined ? {} : { poolQuest }), rewardKey, reward: { xp: reward.xp, coins: 0 }, catalogueVersion, at, ...(cause && { cause }) });
  return true;
}
