import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { kudosGivenEventValidator, type KudosGivenEvent } from "../bus/events";
import type { AwardId, AwardWithId } from "../engine/awards";
import { republish } from "../feedback/homes";
import { tellTiersEarned } from "../feedback/tierNotices";
import { isOpened } from "../feedback/unlockFilter";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { achievementsApplyIn, achievementsLiveIn, bookLaunchedAt } from "./flag";
import { ladders, ladderOf, type LadderId, type PromisedReward, type Tier, type TierId, type TierRef } from "./ladders";
import { earnedTiersOf, earnTier, type EarnedTier, type Reaching } from "./tiers";

export type TierFacts = { tier: TierId; name: string; count: number; earnedAt: number | null; catalogueVersion: string | null; rewards: PromisedReward[] };

export type LadderFacts = { ladder: LadderId; name: string; counts: string; count: number; tiers: TierFacts[]; next: TierId | null };

export type AchievementFacts = { ladders: LadderFacts[] };

type Counting = { member: MemberId; ladder: LadderId };

type Counted = { event: KudosGivenEvent; shown: boolean; earned: Map<MemberId, TierRef[]> };

export const countKudosGiven = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    const shown = await achievementsLiveIn(ctx, event.workspace);
    const launchedAt = await bookLaunchedAt(ctx, event.workspace);
    if (launchedAt === null || event.at < launchedAt) return;
    const counted: Counted = { event, shown, earned: new Map() };
    for (const award of event.awards) {
      await countFor(ctx, counted, { member: award.giver, ladder: "generosity" }, award);
      await countFor(ctx, counted, { member: award.recipient, ladder: "recognition" }, award);
    }
    if (!shown) return;
    for (const [member, earned] of counted.earned) {
      if (await isOpened(ctx, member, "book")) await republish(ctx, member);
      await tellTiersEarned(ctx, { member, message: event.message, at: event.at, earned });
    }
  },
});

export const achievementsOf = internalQuery({
  args: { member: v.id("members") },
  handler: async (ctx, { member }): Promise<AchievementFacts | null> => {
    const { workspace } = await chatUserOf(ctx, member);
    if (!(await achievementsApplyIn(ctx, workspace)) || (await bookLaunchedAt(ctx, workspace)) === null) return null;
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
  const earned = await earnedTiersOf(ctx, member, ladder);
  const { name, counts, tiers } = ladderOf(ladder);
  const tierFacts = tiers.map((tier) => tierFactsOf(tier, earned.find((row) => row.tier === tier.tier)));
  return { ladder, name, counts, count, tiers: tierFacts, next: tierFacts.find(({ earnedAt }) => earnedAt === null)?.tier ?? null };
}

function tierFactsOf({ tier, name, count, rewards }: Tier, earned: EarnedTier | undefined): TierFacts {
  if (earned === undefined) return { tier, name, count, earnedAt: null, catalogueVersion: null, rewards };
  return { tier, name, count, earnedAt: earned.earnedAt, catalogueVersion: earned.catalogueVersion, rewards: earned.rewards };
}

async function countFor(ctx: MutationCtx, { event, shown, earned }: Counted, counting: Counting, award: AwardWithId) {
  const reached = await countAward(ctx, { workspace: event.workspace, ...counting, award: award.award, at: event.at, hidden: !shown }, award.kudos);
  if (reached !== null) earned.set(counting.member, [...(earned.get(counting.member) ?? []), ...reached]);
}

async function countAward(ctx: MutationCtx, reaching: Reaching, kudos: number): Promise<TierRef[] | null> {
  const counting = { member: reaching.member, ladder: reaching.ladder };
  if (await isCounted(ctx, counting, reaching.award)) return null;
  await ctx.db.insert("countedAwards", { award: reaching.award, ...counting });
  const count = await addToCount(ctx, counting, kudos);
  const earned: TierRef[] = [];
  for (const tier of ladderOf(counting.ladder).tiers) {
    if (tier.count <= count && (await earnTier(ctx, reaching, tier))) earned.push({ ladder: counting.ladder, tier: tier.tier });
  }
  return earned;
}

async function addToCount(ctx: MutationCtx, counting: Counting, kudos: number) {
  const row = await countRow(ctx, counting);
  const count = (row?.count ?? 0) + kudos;
  if (row === null) await ctx.db.insert("ladderCounts", { ...counting, count });
  else await ctx.db.patch(row._id, { count });
  return count;
}

async function isCounted(ctx: QueryCtx, { member, ladder }: Counting, award: AwardId) {
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
