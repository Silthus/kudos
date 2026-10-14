import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { rewardsPage } from "../progression/rewards";
import type { MemberId } from "../workspace/directory";
import { crateOpeningOf, rewardKeyOf, rewardKeyPrefixOf, weeklyQuestOfRewardKey } from "./crates";
import type { Quest } from "./step";
import type { WeekKey } from "./week";

const rewardsPerPage = 100;

export async function crateFinished(ctx: MutationCtx, member: MemberId, quest: Quest) {
  if (quest.kind === "weekly") await ctx.db.insert("pendingCrates", { member, key: rewardKeyOf(quest) });
}

export async function crateOpened(ctx: MutationCtx, member: MemberId, key: string) {
  const pending = await pendingCrateOf(ctx, member, key);
  if (pending !== null) await ctx.db.delete(pending._id);
}

export function pendingWeeklyCratesBefore(ctx: QueryCtx, member: MemberId, week: WeekKey) {
  const weekly = rewardKeyPrefixOf("weekly");
  return ctx.db
    .query("pendingCrates")
    .withIndex("by_member_key", (q) => q.eq("member", member).gte("key", weekly).lt("key", `${weekly}${week}:`))
    .collect();
}

export const backfillPendingCrates = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }): Promise<void> => {
    const { page, isDone, continueCursor } = await rewardsPage(ctx, cursor ?? null, rewardsPerPage);
    for (const { member, key } of page) if (await waitsUnindexed(ctx, member, key)) await ctx.db.insert("pendingCrates", { member, key });
    if (!isDone) await ctx.scheduler.runAfter(0, internal.quests.pendingCrates.backfillPendingCrates, { cursor: continueCursor });
  },
});

async function waitsUnindexed(ctx: QueryCtx, member: MemberId, key: string) {
  return weeklyQuestOfRewardKey(key) !== null && (await crateOpeningOf(ctx, member, key)) === null && (await pendingCrateOf(ctx, member, key)) === null;
}

function pendingCrateOf(ctx: QueryCtx, member: MemberId, key: string) {
  return ctx.db
    .query("pendingCrates")
    .withIndex("by_member_key", (q) => q.eq("member", member).eq("key", key))
    .unique();
}
