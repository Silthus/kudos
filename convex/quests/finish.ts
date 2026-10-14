import type { MutationCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import { recordReward } from "../progression/progression";
import type { MemberId } from "../workspace/directory";
import { rewardKeyOf } from "./crates";
import type { Reward } from "./journey";
import type { Quest } from "./step";

export type PromisedReward = { reward: Reward; catalogueVersion: string };

export async function finishQuest(ctx: MutationCtx, workspace: string, member: MemberId, quest: Quest, { reward, catalogueVersion }: PromisedReward, at: number): Promise<boolean> {
  const recorded = await recordReward(ctx, workspace, { member, key: rewardKeyOf(quest), ...reward, catalogueVersion, at });
  if (recorded !== "recorded") return false;
  await publish(ctx, { type: "questFinished", workspace, member, quest, at });
  return true;
}
