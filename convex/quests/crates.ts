import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { appliedRewardValidator, rewardOf, type RewardRecord } from "../progression/rewards";
import type { MemberId } from "../workspace/directory";
import { journeyStepValidator, type JourneyQuest, type Quest, type WeeklyQuest } from "./step";

export const crateOpeningValidator = v.object({ member: v.id("members"), key: v.string(), at: v.number(), applied: v.optional(appliedRewardValidator) });

export const pendingCrateValidator = v.object({ member: v.id("members"), key: v.string() });

export function rewardKeyOf(quest: Quest) {
  switch (quest.kind) {
    case "journey":
      return `${rewardKeyPrefixOf("journey")}${quest.step}`;
    case "weekly":
      return `${rewardKeyPrefixOf("weekly")}${quest.week}:${quest.slot}`;
    case "group":
      return `${rewardKeyPrefixOf("group")}${quest.group}:${quest.week}`;
  }
}

export function weeklyQuestOfRewardKey(key: string): WeeklyQuest | null {
  const match = new RegExp(`^${rewardKeyPrefixOf("weekly")}(.+):(\\d+)$`).exec(key);
  return match === null ? null : { kind: "weekly", week: match[1]!, slot: Number(match[2]) };
}

export function groupWeekOfRewardKey(key: string): { group: string; week: string } | null {
  const match = new RegExp(`^${rewardKeyPrefixOf("group")}([^:]+):(.+)$`).exec(key);
  return match === null ? null : { group: match[1]!, week: match[2]! };
}

export function journeyQuestOfRewardKey(key: string): JourneyQuest | null {
  const step = journeyStepValidator.members.map(({ value }) => value).find((candidate) => key === rewardKeyOf({ kind: "journey", step: candidate }));
  return step === undefined ? null : { kind: "journey", step };
}

export function rewardKeyPrefixOf(kind: Quest["kind"]) {
  return `${kind}:`;
}

export async function rewardWaits(ctx: QueryCtx, member: MemberId, key: string): Promise<boolean> {
  return recordWaits(ctx, await rewardOf(ctx, member, key));
}

export async function recordWaits(ctx: QueryCtx, reward: RewardRecord | null): Promise<boolean> {
  return reward?.held === true && (await crateOpeningOf(ctx, reward.member, reward.key)) === null;
}

export function waitsUnopened(reward: RewardRecord | null, opening: Doc<"crateOpenings"> | null): boolean {
  return reward?.held === true && opening === null;
}

export function crateOpeningOf(ctx: QueryCtx, member: MemberId, key: string) {
  return ctx.db
    .query("crateOpenings")
    .withIndex("by_member_key", (q) => q.eq("member", member).eq("key", key))
    .unique();
}
