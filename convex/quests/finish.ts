import type { MutationCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import type { MessageRef } from "../engine/messageEvent";
import { republish } from "../feedback/homes";
import { recordReward } from "../progression/progression";
import { rewardOf } from "../progression/rewards";
import type { MemberId } from "../workspace/directory";
import { rewardKeyOf } from "./crates";
import { rewardHeldFor } from "./crateRewardsFlag";
import type { Reward } from "./journey";
import { crateFinished } from "./pendingCrates";
import type { QuestId } from "./pool";
import type { Quest } from "./step";

export type PromisedReward = { reward: Reward; catalogueVersion: string; poolQuest?: QuestId };

export async function finishQuest(ctx: MutationCtx, workspace: string, member: MemberId, quest: Quest, { reward, catalogueVersion, poolQuest }: PromisedReward, at: number, cause?: MessageRef): Promise<boolean> {
  const key = rewardKeyOf(quest);
  if ((await rewardOf(ctx, member, key)) !== null) return false;
  const held = await rewardHeldFor(ctx, member);
  await recordReward(ctx, workspace, { member, key, ...reward, catalogueVersion, at, ...(cause && { cause }), ...(held && { held }) });
  await crateFinished(ctx, member, quest);
  const { xp, coins } = reward;
  await publish(ctx, { type: "questFinished", workspace, member, quest, ...(poolQuest === undefined ? {} : { poolQuest }), reward: { xp, coins }, at });
  if (held) await republish(ctx, member);
  return true;
}
