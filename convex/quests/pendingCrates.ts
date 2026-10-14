import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
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

type BackfilledPage = { isDone: boolean; cursor: string };

export const backfillPendingCrates = observedAction({
  args: {},
  handler: async (ctx): Promise<null> => {
    let cursor: string | null = null;
    while (true) {
      const page: BackfilledPage = await ctx.runMutation(internal.quests.pendingCrates.backfillPage, { cursor });
      if (page.isDone) return null;
      cursor = page.cursor;
    }
  },
});

export const backfillPage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }): Promise<BackfilledPage> => {
    const { page, isDone, continueCursor } = await rewardsPage(ctx, cursor, rewardsPerPage);
    for (const { member, key } of page) if (await waitsUnindexed(ctx, member, key)) await ctx.db.insert("pendingCrates", { member, key });
    return { isDone, cursor: continueCursor };
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
