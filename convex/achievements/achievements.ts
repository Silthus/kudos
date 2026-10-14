import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { kudosGivenEventValidator, type KudosGivenEvent } from "../bus/events";
import type { AwardWithId } from "../engine/awards";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { achievementsApplyIn, achievementsLiveIn, bookLaunchedAt } from "./flag";
import { ladders, ladderOf, type LadderId, type PromisedReward, type TierId } from "./ladders";
import { earnedTiersOf, earnTier } from "./tiers";

export type EarnedTierFacts = { tier: TierId; earnedAt: number; catalogueVersion: string; rewards: PromisedReward[] };

export type NextTierFacts = { tier: TierId; count: number; rewards: PromisedReward[] };

export type LadderFacts = { ladder: LadderId; count: number; earned: EarnedTierFacts[]; next: NextTierFacts | null };

export type AchievementFacts = { ladders: LadderFacts[] };

type Counting = { member: MemberId; ladder: LadderId };

export const countKudosGiven = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    await achievementsLiveIn(ctx, event.workspace);
    const launchedAt = await bookLaunchedAt(ctx, event.workspace);
    if (launchedAt === null || event.at < launchedAt) return;
    for (const award of event.awards) {
      await countAward(ctx, event, { member: award.giver, ladder: "generosity" }, award);
      await countAward(ctx, event, { member: award.recipient, ladder: "recognition" }, award);
    }
  },
});

export const achievementsOf = internalQuery({
  args: { member: v.id("members") },
  handler: async (ctx, { member }): Promise<AchievementFacts | null> => {
    const { workspace } = await chatUserOf(ctx, member);
    if (!(await achievementsApplyIn(ctx, workspace))) return null;
    return bookFactsOf(ctx, member);
  },
});

export async function bookFactsOf(ctx: QueryCtx, member: MemberId): Promise<AchievementFacts> {
  const facts: LadderFacts[] = [];
  for (const { ladder } of ladders.ladders) facts.push(await ladderFactsOf(ctx, member, ladder));
  return { ladders: facts };
}

async function ladderFactsOf(ctx: QueryCtx, member: MemberId, ladder: LadderId): Promise<LadderFacts> {
  const count = (await countRow(ctx, { member, ladder }))?.count ?? 0;
  const earnedRows = await earnedTiersOf(ctx, member, ladder);
  const { tiers } = ladderOf(ladder);
  const earned = tiers.flatMap(({ tier }) => earnedRows.filter((row) => row.tier === tier)).map(({ tier, earnedAt, catalogueVersion, rewards }) => ({ tier, earnedAt, catalogueVersion, rewards }));
  const next = tiers.find(({ tier }) => !earned.some((row) => row.tier === tier));
  return { ladder, count, earned, next: next === undefined ? null : { tier: next.tier, count: next.count, rewards: next.rewards } };
}

async function countAward(ctx: MutationCtx, event: KudosGivenEvent, counting: Counting, award: AwardWithId) {
  if (await isCounted(ctx, counting, award)) return;
  await ctx.db.insert("countedAwards", { award: award.award, ...counting });
  const count = await addToCount(ctx, counting, award.kudos);
  const reaching = { workspace: event.workspace, ...counting, award: award.award, at: event.at };
  for (const tier of ladderOf(counting.ladder).tiers) if (tier.count <= count) await earnTier(ctx, reaching, tier);
}

async function addToCount(ctx: MutationCtx, counting: Counting, kudos: number) {
  const row = await countRow(ctx, counting);
  const count = (row?.count ?? 0) + kudos;
  if (row === null) await ctx.db.insert("ladderCounts", { ...counting, count });
  else await ctx.db.patch(row._id, { count });
  return count;
}

async function isCounted(ctx: QueryCtx, { member, ladder }: Counting, { award }: AwardWithId) {
  const row = await ctx.db
    .query("countedAwards")
    .withIndex("by_award_member_ladder", (q) => q.eq("award", award).eq("member", member).eq("ladder", ladder))
    .unique();
  return row !== null;
}

function countRow(ctx: QueryCtx, { member, ladder }: Counting) {
  return ctx.db
    .query("ladderCounts")
    .withIndex("by_member_ladder", (q) => q.eq("member", member).eq("ladder", ladder))
    .unique();
}
