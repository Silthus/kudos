import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { kudosGivenEventValidator, type KudosGivenEvent } from "../bus/events";
import { republish } from "../feedback/homes";
import type { CompletedTeam } from "../feedback/notify";
import { tellTiersEarned } from "../feedback/tierNotices";
import { isOpened } from "../feedback/unlockFilter";
import { messageOfAward, type AwardId, type AwardWithId } from "../engine/awards";
import { tierItemOf, type CatalogueItem } from "../store/catalogue";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { countAward, countCompletions, countingOf, countOf, type Completion, type CompletionTier } from "./counting";
import { achievementsApplyIn, achievementsLiveIn, bookAppliesIn, bookLaunchedAt } from "./flag";
import { coinsPaidBy, ladders, ladderOf, tierRefValidator, type AwardLadderId, type LadderId, type Tier, type TierId, type TierRef } from "./ladders";
import { laddersCountedLiveIn, replayWhatIsNew } from "./replay";
import { laddersShownTo } from "./shown";
import { tierRewardsRecordedFor, type TierRewardsRecorded } from "./tierRewards";
import { earnedTiersOf, type EarnedTier } from "./tiers";

export type TierItemFacts = Pick<CatalogueItem, "item" | "name" | "emoji" | "art">;

export type RewardFacts =
  | { kind: "hedgehog"; reward: string }
  | { kind: "kudosEmoji"; reward: string; item: TierItemFacts; recordedAt?: number | null }
  | { kind: "coins"; reward: string; coins: number; recordedAt?: number | null };

export type TierFacts = { tier: TierId; name: string; count: number; earnedAt: number | null; catalogueVersion: string | null; rewards: RewardFacts[] };

export type LadderFacts = { ladder: LadderId; name: string; counts: string; count: number; tiers: TierFacts[]; next: TierId | null };

export type AchievementFacts = { ladders: LadderFacts[] };

const awardsAPage = 25;

const untoldValidator = v.array(v.object({ member: v.id("members"), earned: v.array(tierRefValidator) }));

type Untold = Infer<typeof untoldValidator>;

type Counted = Map<MemberId, TierRef[]>;

export type CompletionsRecorded = { workspace: string; member: MemberId };

export const countKudosGiven = internalMutation({
  args: { event: kudosGivenEventValidator, from: v.optional(v.number()), untold: v.optional(untoldValidator) },
  handler: async (ctx, { event, from = 0, untold = [] }): Promise<void> => {
    const shown = await achievementsLiveIn(ctx, event.workspace);
    if ((await bookLaunchedAt(ctx, event.workspace)) === null) return;
    await replayWhatIsNew(ctx, event.workspace);
    const live = await laddersCountedLiveIn(ctx, event.workspace);
    const next = from + awardsAPage;
    const counted = await countPage(ctx, event, live, { awards: event.awards.slice(from, next), shown, untold });
    const later = event.awards.slice(next);
    const countedLater = membersCountedIn(live, later);
    if (later.length > 0) await ctx.scheduler.runAfter(0, internal.achievements.achievements.countKudosGiven, { event, from: next, untold: shown ? untoldAmong(counted, countedLater) : untold });
    if (!shown) return;
    for (const [member, earned] of counted) {
      if (countedLater.has(member)) continue;
      if (await isOpened(ctx, member, "book")) await republish(ctx, member);
      await tellTiersEarned(ctx, { member, message: event.message, at: event.at, earned: inCatalogueOrder(earned) });
    }
  },
});

export type CompletedUnder = Map<AwardId, { at: number; teams: CompletedTeam[] }>;

export async function countTeamPagesCompleted(ctx: MutationCtx, recorded: CompletionsRecorded, completions: Completion[], completed: CompletedUnder): Promise<void> {
  const told = await tiersCountedFrom(ctx, recorded, completions);
  for (const award of new Set([...told.keys(), ...completed.keys()])) {
    const message = await messageOfAward(ctx, award);
    const earned = told.get(award) ?? [];
    const teams = completed.get(award);
    if (message !== null) await tellTiersEarned(ctx, { member: recorded.member, message, at: earned[0]?.reaching.at ?? teams!.at, earned: earned.map(({ tier }) => tier), completed: teams?.teams ?? [] });
  }
}

async function tiersCountedFrom(ctx: MutationCtx, { workspace, member }: CompletionsRecorded, completions: Completion[]): Promise<Map<AwardId, CompletionTier[]>> {
  if (completions.length === 0) return new Map();
  const shown = await achievementsApplyIn(ctx, workspace);
  const { changed, told } = await countCompletions(ctx, { workspace, member, ladder: "team-spirit" }, completions, shown ? {} : { hidden: true });
  if (!shown || !changed) return new Map();
  if (await isOpened(ctx, member, "book")) await republish(ctx, member);
  return byReachingAward(told);
}

function byReachingAward(told: CompletionTier[]): Map<AwardId, CompletionTier[]> {
  const byAward = new Map<AwardId, CompletionTier[]>();
  for (const each of told) byAward.set(each.reaching.award, [...(byAward.get(each.reaching.award) ?? []), each]);
  return byAward;
}

type Page = { awards: AwardWithId[]; shown: boolean; untold: Untold };

async function countPage(ctx: MutationCtx, event: KudosGivenEvent, live: AwardLadderId[], { awards, shown, untold }: Page): Promise<Counted> {
  const counted: Counted = new Map(untold.map(({ member, earned }) => [member, earned]));
  for (const ladder of live) {
    for (const award of awards) {
      const counting = countingOf(ladder, award);
      const earned = await countAward(ctx, event.workspace, counting, { ...award, day: event.day, at: event.at }, { tiers: ladderOf(ladder).tiers, ...(!shown && { hidden: true }) });
      if (earned !== null) counted.set(counting.member, [...(counted.get(counting.member) ?? []), ...earned]);
    }
  }
  return counted;
}

function membersCountedIn(live: AwardLadderId[], awards: AwardWithId[]): Set<MemberId> {
  return new Set(live.flatMap((ladder) => awards.map((award) => countingOf(ladder, award).member)));
}

function inCatalogueOrder(earned: TierRef[]): TierRef[] {
  return ladders.ladders.flatMap(({ ladder, tiers }) => tiers.filter(({ tier }) => earned.some((ref) => ref.ladder === ladder && ref.tier === tier)).map(({ tier }) => ({ ladder, tier })));
}

function untoldAmong(counted: Counted, countedLater: Set<MemberId>): Untold {
  return [...counted].filter(([member]) => countedLater.has(member)).map(([member, earned]) => ({ member, earned }));
}

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
  const recorded = await tierRewardsRecordedFor(ctx, member);
  for (const ladder of await laddersShownTo(ctx, member)) facts.push(await ladderFactsOf(ctx, member, ladder, recorded));
  return { ladders: facts };
}

async function ladderFactsOf(ctx: QueryCtx, member: MemberId, ladder: LadderId, recorded: TierRewardsRecorded): Promise<LadderFacts> {
  const count = await countOf(ctx, { member, ladder });
  const earned = await earnedTiersOf(ctx, member, ladder);
  const { name, counts, tiers } = ladderOf(ladder);
  const tierFacts = tiers.map((tier) => tierFactsOf(ladder, tier, earned.find((row) => row.tier === tier.tier), recorded));
  return { ladder, name, counts, count, tiers: tierFacts, next: tierFacts.find(({ earnedAt }) => earnedAt === null)?.tier ?? null };
}

function tierFactsOf(ladder: LadderId, { tier, name, count, rewards }: Tier, earned: EarnedTier | undefined, recorded: TierRewardsRecorded): TierFacts {
  if (earned === undefined) return { tier, name, count, earnedAt: null, catalogueVersion: null, rewards: rewardFactsOf(ladder, { tier, rewards }) };
  return { tier, name, count, earnedAt: earned.earnedAt, catalogueVersion: earned.catalogueVersion, rewards: rewardFactsOf(ladder, { tier, rewards: earned.rewards }, recorded) };
}

function rewardFactsOf(ladder: LadderId, { tier, rewards }: Pick<Tier, "tier" | "rewards">, recorded?: TierRewardsRecorded): RewardFacts[] {
  return rewards.map(({ kind, reward }) => {
    const recordedAt = recorded === undefined ? {} : { recordedAt: recorded.get(reward)?.recordedAt ?? null };
    if (kind === "coins") return { kind, reward, coins: coinsPaidBy(tier), ...recordedAt };
    if (kind === "kudosEmoji") return { kind, reward, item: tierItemFactsOf(ladder), ...recordedAt };
    return { kind, reward };
  });
}

function tierItemFactsOf(ladder: LadderId): TierItemFacts {
  const { item, name, emoji, art } = tierItemOf(ladder);
  return { item, name, emoji, art };
}
