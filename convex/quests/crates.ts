import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import type { Quest } from "./step";

export const crateOpeningValidator = v.object({ member: v.id("members"), key: v.string(), at: v.number() });

export function rewardKeyOf(quest: Quest) {
  return quest.kind === "journey" ? `${rewardKeyPrefixOf("journey")}${quest.step}` : `${rewardKeyPrefixOf("weekly")}${quest.week}:${quest.slot}`;
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
