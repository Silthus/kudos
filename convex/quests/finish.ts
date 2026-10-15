import type { MutationCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import type { MessageRef } from "../engine/messageEvent";
import { recordReward } from "../progression/progression";
import type { MemberId } from "../workspace/directory";
import { rewardKeyOf } from "./crates";
import type { GroupQuestId } from "./groupPool";
import type { Reward } from "./journey";
import { crateFinished } from "./pendingCrates";
import type { QuestId } from "./pool";
import type { Quest } from "./step";

export type PromisedReward = { reward: Reward; catalogueVersion: string; poolQuest?: QuestId | GroupQuestId };

export async function finishQuest(ctx: MutationCtx, workspace: string, member: MemberId, quest: Quest, { reward, catalogueVersion, poolQuest }: PromisedReward, at: number, cause?: MessageRef): Promise<boolean> {
  const recorded = await recordReward(ctx, workspace, { member, key: rewardKeyOf(quest), ...reward, catalogueVersion, at, ...(cause && { cause }) });
  if (recorded !== "recorded") return false;
  await crateFinished(ctx, member, quest);
  const { xp, coins } = reward;
  await publish(ctx, { type: "questFinished", workspace, member, quest, ...(poolQuest === undefined ? {} : { poolQuest }), reward: { xp, coins }, at });
  return true;
}
