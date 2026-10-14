import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import type { Quest, WeeklyQuest } from "./step";

export const crateOpeningValidator = v.object({ member: v.id("members"), key: v.string(), at: v.number() });

export const pendingCrateValidator = v.object({ member: v.id("members"), key: v.string() });

export function rewardKeyOf(quest: Quest) {
  return quest.kind === "journey" ? `${rewardKeyPrefixOf("journey")}${quest.step}` : `${rewardKeyPrefixOf("weekly")}${quest.week}:${quest.slot}`;
}

export function weeklyQuestOfRewardKey(key: string): WeeklyQuest | null {
  const match = new RegExp(`^${rewardKeyPrefixOf("weekly")}(.+):(\\d+)$`).exec(key);
  return match === null ? null : { kind: "weekly", week: match[1]!, slot: Number(match[2]) };
}

export function rewardKeyPrefixOf(kind: Quest["kind"]) {
  return `${kind}:`;
}

export function crateOpeningOf(ctx: QueryCtx, member: MemberId, key: string) {
  return ctx.db
    .query("crateOpenings")
    .withIndex("by_member_key", (q) => q.eq("member", member).eq("key", key))
    .unique();
}
