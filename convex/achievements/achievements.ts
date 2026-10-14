import { v } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "../_generated/server";
import { kudosGivenEventValidator } from "../bus/events";
import { republish } from "../feedback/homes";
import { tellTiersEarned } from "../feedback/tierNotices";
import { isOpened } from "../feedback/unlockFilter";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { countAward, countingOf, countOf } from "./counting";
import { achievementsLiveIn, bookAppliesIn, bookLaunchedAt } from "./flag";
import { coinsPaidBy, ladders, ladderOf, type LadderId, type Tier, type TierId, type TierRef } from "./ladders";
import { laddersCountedLiveIn, replayWhatIsNew } from "./replay";
import { tierCoinsPaidTo, type TierCoinsPaid } from "./tierCoins";
import { earnedTiersOf, type EarnedTier } from "./tiers";

export type RewardFacts = { kind: "kudosEmoji" | "hedgehog"; reward: string } | { kind: "coins"; reward: string; coins: number; recordedAt?: number | null };

export type TierFacts = { tier: TierId; name: string; count: number; earnedAt: number | null; catalogueVersion: string | null; rewards: RewardFacts[] };

export type LadderFacts = { ladder: LadderId; name: string; counts: string; count: number; tiers: TierFacts[]; next: TierId | null };

export type AchievementFacts = { ladders: LadderFacts[] };

export const countKudosGiven = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: async (ctx, { event }): Promise<void> => {
    const shown = await achievementsLiveIn(ctx, event.workspace);
    if ((await bookLaunchedAt(ctx, event.workspace)) === null) return;
    await replayWhatIsNew(ctx, event.workspace);
    const counted = new Map<MemberId, TierRef[]>();
    for (const ladder of await laddersCountedLiveIn(ctx, event.workspace)) {
      for (const award of event.awards) {
        const counting = countingOf(ladder, award);
        const earned = await countAward(ctx, event.workspace, counting, { ...award, day: event.day, at: event.at }, { tiers: ladderOf(ladder).tiers, ...(!shown && { hidden: true }) });
        if (earned !== null) counted.set(counting.member, [...(counted.get(counting.member) ?? []), ...earned]);
      }
    }
    if (!shown) return;
    for (const [member, earned] of counted) {
      if (await isOpened(ctx, member, "book")) await republish(ctx, member);
      await tellTiersEarned(ctx, { member, message: event.message, at: event.at, earned });
    }
  },
});

export const achievementsOf = internalQuery({
  args: { member: v.id("members") },
  handler: (ctx, { member }) => achievementFactsOf(ctx, member),
});

export async function achievementFactsOf(ctx: QueryCtx, member: MemberId): Promise<AchievementFacts | null> {
  const { workspace } = await chatUserOf(ctx, member);
  if (!(await bookAppliesIn(ctx, workspace))) return null;
  return bookFactsOf(ctx, member);
}

export async function bookFactsOf(ctx: QueryCtx, member: MemberId): Promise<AchievementFacts> {
  const facts: LadderFacts[] = [];
  const paid = await tierCoinsPaidTo(ctx, member);
  for (const { ladder } of ladders.ladders) facts.push(await ladderFactsOf(ctx, member, ladder, paid));
  return { ladders: facts };
}

async function ladderFactsOf(ctx: QueryCtx, member: MemberId, ladder: LadderId, paid: TierCoinsPaid): Promise<LadderFacts> {
  const count = await countOf(ctx, { member, ladder });
  const earned = await earnedTiersOf(ctx, member, ladder);
  const { name, counts, tiers } = ladderOf(ladder);
  const tierFacts = tiers.map((tier) => tierFactsOf(tier, earned.find((row) => row.tier === tier.tier), paid));
  return { ladder, name, counts, count, tiers: tierFacts, next: tierFacts.find(({ earnedAt }) => earnedAt === null)?.tier ?? null };
}

function tierFactsOf({ tier, name, count, rewards }: Tier, earned: EarnedTier | undefined, paid: TierCoinsPaid): TierFacts {
  if (earned === undefined) return { tier, name, count, earnedAt: null, catalogueVersion: null, rewards: rewardFactsOf({ tier, rewards }) };
  return { tier, name, count, earnedAt: earned.earnedAt, catalogueVersion: earned.catalogueVersion, rewards: rewardFactsOf({ tier, rewards: earned.rewards }, paid) };
}

function rewardFactsOf({ tier, rewards }: Pick<Tier, "tier" | "rewards">, paid?: TierCoinsPaid): RewardFacts[] {
  return rewards.map(({ kind, reward }) => {
    if (kind !== "coins") return { kind, reward };
    return { kind, reward, coins: coinsPaidBy(tier), ...(paid !== undefined && { recordedAt: paid.get(reward)?.recordedAt ?? null }) };
  });
}
