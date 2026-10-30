import type { QueryCtx } from "../_generated/server";
import type { MessageRef } from "../engine/messageEvent";
import { rewardsCausedBy } from "../progression/rewards";
import type { MemberId } from "../workspace/directory";
import { journeyQuestOfRewardKey, weeklyQuestOfRewardKey } from "./crates";
import { isPaidOnTheMondayPath } from "./mondayCatalogue";
import { finishedStepGoalOf } from "./onboarding";
import { weeklyGoalOf } from "./weekly";

export type QuestFinishedBy = { kind: "weekly" | "journey"; goal: string; xp: number; hoggie: boolean };

export async function questsFinishedByMessage(ctx: QueryCtx, member: MemberId, message: MessageRef): Promise<QuestFinishedBy[]> {
  const finished: QuestFinishedBy[] = [];
  for (const { key, xp } of (await rewardsCausedBy(ctx, member, message)).filter(isPaidOnTheMondayPath)) {
    const weekly = weeklyQuestOfRewardKey(key);
    const journey = journeyQuestOfRewardKey(key);
    if (weekly !== null) finished.push({ kind: "weekly", goal: await weeklyGoalOf(ctx, member, weekly), xp, hoggie: true });
    else if (journey !== null) finished.push({ kind: "journey", goal: finishedStepGoalOf(journey.step, true), xp, hoggie: true });
  }
  return finished;
}
