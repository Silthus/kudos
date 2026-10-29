import type { MutationCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import type { MessageRef } from "../engine/messageEvent";
import { republish } from "../feedback/homes";
import { earnItem } from "../album/items/ledger";
import { belongsInTheFinishRecord, recordQuestFinish } from "./finishes";
import { recordReward } from "../progression/progression";
import { rewardOf } from "../progression/rewards";
import type { MemberId } from "../workspace/directory";
import { rewardKeyOf } from "./crates";
import { rewardHeldFor } from "./crateRewardsFlag";
import { questsApplyTo } from "./flag";
import type { GroupQuestId } from "./groupPool";
import type { Reward } from "./journey";
import { crateFinished } from "./pendingCrates";
import type { QuestId } from "./pool";
import type { Quest } from "./step";

export type PromisedReward = { reward: Reward; catalogueVersion: string; poolQuest?: QuestId | GroupQuestId };

export function questItemKeyOf(rewardKey: string): `quest:${string}` {
  return `quest:${rewardKey}`;
}

export async function finishMondayQuest(ctx: MutationCtx, workspace: string, member: MemberId, quest: Quest, { reward, catalogueVersion, poolQuest }: PromisedReward, at: number, cause?: MessageRef): Promise<boolean> {
  const key = rewardKeyOf(quest);
  const recorded = await recordReward(ctx, workspace, { member, key, ...reward, coins: 0, catalogueVersion, at, ...(cause && { cause }) });
  if (recorded === "already recorded") return false;
  await recordQuestFinish(ctx, { member, key, xp: reward.xp, catalogueVersion, at, ...(cause && { cause }) });
  await earnItem(ctx, { workspace, member, source: "hoggie", key: questItemKeyOf(key), reason: { kind: "quest", quest }, earnedAt: at });
  await publish(ctx, { type: "questFinished", workspace, member, quest, ...(poolQuest === undefined ? {} : { poolQuest }), reward: { xp: reward.xp, coins: 0 }, at });
  return true;
}

export async function finishQuest(ctx: MutationCtx, workspace: string, member: MemberId, quest: Quest, { reward, catalogueVersion, poolQuest }: PromisedReward, at: number, cause?: MessageRef): Promise<boolean> {
  const key = rewardKeyOf(quest);
  if ((await rewardOf(ctx, member, key)) !== null) return false;
  const held = (await questsApplyTo(ctx, member)) && (await rewardHeldFor(ctx, member));
  await recordReward(ctx, workspace, { member, key, ...reward, catalogueVersion, at, ...(cause && { cause }), ...(held && { held }) });
  const finish = { member, key, xp: reward.xp, catalogueVersion, at, ...(cause && { cause }) };
  if (belongsInTheFinishRecord(finish)) await recordQuestFinish(ctx, finish);
  await crateFinished(ctx, member, quest);
  const { xp, coins } = reward;
  await publish(ctx, { type: "questFinished", workspace, member, quest, ...(poolQuest === undefined ? {} : { poolQuest }), reward: { xp, coins }, at });
  if (held) await republish(ctx, member);
  return true;
}
