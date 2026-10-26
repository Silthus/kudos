import type { QueryCtx } from "../_generated/server";
import { rewardsKeyedFrom } from "../progression/rewards";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { crateOpenedAt, crateOpeningOf, journeyQuestOfRewardKey, rewardKeyPrefixOf } from "./crates";
import { journeyStepAppliesTo, questsApplyTo } from "./flag";
import { groupQuestAppliesTo } from "./groupQuest";
import { pendingCratesOldestFirst, pendingWeeklyCratesInWeekOrder } from "./pendingCrates";

export type WaitingQuestCrate = { crate: string; at: number };

export async function waitingQuestCratesOf(ctx: QueryCtx, member: MemberId, limitPerKind: number): Promise<WaitingQuestCrate[]> {
  if (!(await questsApplyTo(ctx, member))) return [];
  return [...(await pendingCratesOpenableBy(ctx, member, limitPerKind)), ...(await journeyCratesOpenableBy(ctx, member))];
}

async function pendingCratesOpenableBy(ctx: QueryCtx, member: MemberId, limit: number): Promise<WaitingQuestCrate[]> {
  const pending = (await groupQuestAppliesTo(ctx, member)) ? await pendingCratesOldestFirst(ctx, member, limit) : await pendingWeeklyCratesInWeekOrder(ctx, member, limit);
  return pending.map(({ key, _creationTime }) => ({ crate: key, at: _creationTime }));
}

async function journeyCratesOpenableBy(ctx: QueryCtx, member: MemberId): Promise<WaitingQuestCrate[]> {
  const { workspace } = await chatUserOf(ctx, member);
  const openable: WaitingQuestCrate[] = [];
  for (const reward of await rewardsKeyedFrom(ctx, member, rewardKeyPrefixOf("journey"))) {
    const journey = journeyQuestOfRewardKey(reward.key);
    if (journey === null || !(await journeyStepAppliesTo(ctx, workspace, member, journey.step))) continue;
    if (crateOpenedAt(reward, await crateOpeningOf(ctx, member, reward.key)) === null) openable.push({ crate: reward.key, at: reward.at });
  }
  return openable;
}
