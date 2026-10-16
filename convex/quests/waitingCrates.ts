import type { QueryCtx } from "../_generated/server";
import { rewardsKeyedFrom } from "../progression/rewards";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { crateOpeningOf, journeyQuestOfRewardKey, rewardKeyPrefixOf } from "./crates";
import { journeyStepAppliesTo, questsApplyTo } from "./flag";
import { groupQuestAppliesTo } from "./groupQuest";
import { pendingCratesOldestFirst } from "./pendingCrates";

export type WaitingQuestCrate = { crate: string; at: number };

export async function waitingQuestCratesOf(ctx: QueryCtx, member: MemberId, limitPerKind: number): Promise<WaitingQuestCrate[]> {
  if (!(await questsApplyTo(ctx, member))) return [];
  return [...(await pendingCratesOpenableBy(ctx, member, limitPerKind)), ...(await journeyCratesOpenableBy(ctx, member))];
}

async function pendingCratesOpenableBy(ctx: QueryCtx, member: MemberId, limit: number): Promise<WaitingQuestCrate[]> {
  const pending = await pendingCratesOldestFirst(ctx, member, limit);
  const groupCratesOpen = await groupQuestAppliesTo(ctx, member);
  const isGroupCrate = (key: string) => key.startsWith(rewardKeyPrefixOf("group"));
  return pending.filter(({ key }) => groupCratesOpen || !isGroupCrate(key)).map(({ key, _creationTime }) => ({ crate: key, at: _creationTime }));
}

async function journeyCratesOpenableBy(ctx: QueryCtx, member: MemberId): Promise<WaitingQuestCrate[]> {
  const { workspace } = await chatUserOf(ctx, member);
  const openable: WaitingQuestCrate[] = [];
  for (const { key, at } of await rewardsKeyedFrom(ctx, member, rewardKeyPrefixOf("journey"))) {
    const journey = journeyQuestOfRewardKey(key);
    if (journey === null || !(await journeyStepAppliesTo(ctx, workspace, member, journey.step))) continue;
    if ((await crateOpeningOf(ctx, member, key)) === null) openable.push({ crate: key, at });
  }
  return openable;
}
