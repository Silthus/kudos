import type { QueryCtx } from "../_generated/server";
import { rewardsKeyedFrom } from "../progression/rewards";
import type { ItemId } from "../store/catalogue";
import type { MemberId } from "../workspace/directory";
import { tierOf, type TierRef } from "./ladders";

export type RecordedTierReward = { coins: number; item: ItemId | null; recordedAt: number };

export type TierRewardsRecorded = Map<string, RecordedTierReward>;

export type TierRewardsTold = { coins: number; items: ItemId[] };

const tierRewardKeys = "tier:";

export function tierRewardKeyOf(reward: string) {
  return `${tierRewardKeys}${reward}`;
}

export async function tierRewardsRecordedFor(ctx: QueryCtx, member: MemberId): Promise<TierRewardsRecorded> {
  const records = await rewardsKeyedFrom(ctx, member, tierRewardKeys);
  return new Map(records.map(({ key, coins, item, _creationTime }) => [key.slice(tierRewardKeys.length), { coins, item, recordedAt: Math.floor(_creationTime) }]));
}

export function recordedRewardsOf(ref: TierRef, recorded: TierRewardsRecorded): TierRewardsTold {
  const records = tierOf(ref).rewards.flatMap(({ reward }) => recorded.get(reward) ?? []);
  return { coins: records.reduce((sum, { coins }) => sum + coins, 0), items: records.flatMap(({ item }) => (item === null ? [] : [item])) };
}
