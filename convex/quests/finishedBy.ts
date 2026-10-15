import type { QueryCtx } from "../_generated/server";
import type { MessageRef } from "../engine/messageEvent";
import { rewardsCausedBy } from "../progression/rewards";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { journeyQuestOfRewardKey, recordWaits, weeklyQuestOfRewardKey } from "./crates";
import { journeyStepNamedTo } from "./flag";
import { journeyGoalOf } from "./journeyCopy";
import { weeklyGoalOf } from "./weekly";

export type QuestFinishedBy = { kind: "weekly" | "journey"; goal: string; xp: number; waiting: boolean };

export async function questsFinishedByMessage(ctx: QueryCtx, member: MemberId, message: MessageRef): Promise<QuestFinishedBy[]> {
  const { workspace } = await chatUserOf(ctx, member);
  const finished: QuestFinishedBy[] = [];
  for (const reward of await rewardsCausedBy(ctx, member, message)) {
    const { key, xp } = reward;
    const weekly = weeklyQuestOfRewardKey(key);
    const journey = journeyQuestOfRewardKey(key);
    if (weekly !== null) finished.push({ kind: "weekly", goal: await weeklyGoalOf(ctx, member, weekly), xp, waiting: await recordWaits(ctx, reward) });
    else if (journey !== null && (await journeyStepNamedTo(ctx, workspace, member, journey.step))) finished.push({ kind: "journey", goal: journeyGoalOf(journey.step), xp, waiting: await recordWaits(ctx, reward) });
  }
  return finished;
}
