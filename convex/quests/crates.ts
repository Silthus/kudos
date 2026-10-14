import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { publish } from "../bus/publish";
import { rewardOf } from "../progression/rewards";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { questsLiveFor } from "./flag";
import type { Quest } from "./step";

export const crateOpeningValidator = v.object({ member: v.id("members"), key: v.string(), at: v.number() });

export async function openQuestCrate(ctx: MutationCtx, member: MemberId, quest: Quest): Promise<"done" | "refused"> {
  const key = rewardKeyOf(quest);
  if ((await rewardOf(ctx, member, key)) === null || !(await questsLiveFor(ctx, member))) return "refused";
  if ((await crateOpeningOf(ctx, member, key)) !== null) return "done";
  const at = Date.now();
  const { workspace } = await chatUserOf(ctx, member);
  await ctx.db.insert("crateOpenings", { member, key, at });
  await publish(ctx, { type: "questOpened", workspace, member, quest, at });
  return "done";
}

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
