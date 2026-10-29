import type { QueryCtx } from "../_generated/server";
import type { MessageRef } from "../engine/messageEvent";
import { rewardsCausedBy } from "../progression/rewards";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { journeyQuestOfRewardKey, rewardWaits, weeklyQuestOfRewardKey } from "./crates";
import { belongsInTheFinishRecord, questFinishesCausedBy } from "./finishes";
import { journeyStepNamedTo } from "./flag";
import { isPaidOnTheMondayPath } from "./mondayCatalogue";
import { finishedStepGoalOf } from "./onboarding";
import { weeklyGoalOf } from "./weekly";

export type QuestFinishedBy = { kind: "weekly" | "journey"; goal: string; xp: number; waiting: boolean; hoggie: boolean };

export async function questsFinishedByMessage(ctx: QueryCtx, member: MemberId, message: MessageRef): Promise<QuestFinishedBy[]> {
  const { workspace } = await chatUserOf(ctx, member);
  const finished: QuestFinishedBy[] = [];
  for (const finish of await finishesCausedBy(ctx, member, message)) {
    const { key, xp } = finish;
    const weekly = weeklyQuestOfRewardKey(key);
    const journey = journeyQuestOfRewardKey(key);
    const hoggie = isPaidOnTheMondayPath(finish);
    if (weekly !== null) finished.push({ kind: "weekly", goal: await weeklyGoalOf(ctx, member, weekly), xp, waiting: await rewardWaits(ctx, member, key), hoggie });
    else if (journey !== null && (await journeyStepNamedTo(ctx, workspace, member, journey.step))) finished.push({ kind: "journey", goal: finishedStepGoalOf(journey.step, hoggie), xp, waiting: await rewardWaits(ctx, member, key), hoggie });
  }
  return finished;
}

async function finishesCausedBy(ctx: QueryCtx, member: MemberId, message: MessageRef) {
  const outsideTheFinishRecord = (await rewardsCausedBy(ctx, member, message)).filter((reward) => !belongsInTheFinishRecord(reward));
  return [...outsideTheFinishRecord, ...(await questFinishesCausedBy(ctx, member, message))];
}
