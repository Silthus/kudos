import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { KudosGivenEvent } from "../bus/events";
import { isSameMessage, type MessageRef } from "../engine/messageEvent";
import { earliestAwardFrom, firstDecidedOf, firstGivenSince, givenBetween, givenSinceWithin, messagesGivenDecidedAfter, type AwardId, type DatedAward } from "../engine/awards";
import { rewardOf, type RewardRecord } from "../progression/rewards";
import type { MemberId } from "../workspace/directory";
import { rewardKeyOf } from "./crates";
import { finishMondayQuest } from "./finish";
import { hasThankedEveryone, type Reward } from "./journey";
import { journeyGoalOf } from "./journeyCopy";
import { isPaidOnTheMondayPath, mondayCatalogueVersion } from "./mondayCatalogue";
import type { Moved, MovedQuest, ProgressRead, QuestProgress } from "./progress";
import { questStartOf } from "./start";
import type { JourneyStep } from "./step";

export const onboardingSteps = ["first-thanks", "someone-new", "two-days"] as const satisfies readonly JourneyStep[];

export type OnboardingStep = (typeof onboardingSteps)[number];

export const onboardingReward: Reward = { xp: 50, coins: 0, item: null };

const daysToFinishTwoDays = 2;

const onboardingGoals: Record<OnboardingStep, string> = {
  "first-thanks": "Give a kudos to someone",
  "someone-new": "Thank someone new",
  "two-days": "Thank someone on two different days",
};

export type FinishedOnboardingQuest = { step: OnboardingStep; reward: Reward };

export type OnboardingQuest = { step: OnboardingStep; goal: string; finished: boolean; progress: QuestProgress | null };

export type OnboardingQuestFacts = { step: OnboardingStep; finish: RewardRecord | null; progress: QuestProgress | null };

export function onboardingGoalOf(step: OnboardingStep): string {
  return onboardingGoals[step];
}

export function finishedStepGoalOf(step: JourneyStep, paidOnTheMondayPath: boolean): string {
  return paidOnTheMondayPath && isOnboardingStep(step) ? onboardingGoalOf(step) : journeyGoalOf(step);
}

export function onboardingTargetOf(step: OnboardingStep): number {
  return step === "two-days" ? daysToFinishTwoDays : 1;
}

export function isOnboardingStep(step: JourneyStep): step is OnboardingStep {
  return (onboardingSteps as readonly JourneyStep[]).includes(step);
}

export async function nextOnboardingQuestOf(ctx: QueryCtx, member: MemberId): Promise<OnboardingStep | null> {
  for (const step of onboardingSteps) if ((await finishOf(ctx, member, step)) === null) return step;
  return null;
}

export async function onboardingQuestsOf(ctx: QueryCtx, member: MemberId, at: number): Promise<OnboardingQuest[]> {
  const facts = await onboardingQuestFactsOf(ctx, member, at);
  return onboardingSteps.map((step) => {
    const { finish, progress } = facts[step];
    return { step, goal: onboardingGoalOf(step), finished: finish !== null, progress };
  });
}

export async function onboardingQuestFactsOf(ctx: QueryCtx, member: MemberId, at: number): Promise<Record<OnboardingStep, OnboardingQuestFacts>> {
  return {
    "first-thanks": { step: "first-thanks", finish: await finishOf(ctx, member, "first-thanks"), progress: null },
    "someone-new": { step: "someone-new", finish: await finishOf(ctx, member, "someone-new"), progress: null },
    "two-days": await twoDaysFactsOf(ctx, member, at),
  };
}

export async function twoDaysMovedSince(ctx: QueryCtx, member: MemberId, { since, until, mostAwards }: ProgressRead): Promise<Moved[]> {
  const start = await questStartOf(ctx, member);
  if (start === null || (await twoDaysFinishedBy(ctx, member, since))) return [];
  const givenSinceTheStart = await givenSinceWithin(ctx, member, start, mostAwards);
  const decidedSince = await messagesGivenDecidedAfter(ctx, member, since, mostAwards);
  if (givenSinceTheStart === null || decidedSince === null) return [];
  const decidedAfter = (instant: number) => new Set<AwardId>(decidedSince.filter(({ created }) => created > instant).flatMap(({ awards }) => awards.map(({ award }) => award)));
  const decidedBy = (instant: number) => {
    const later = decidedAfter(instant);
    return givenSinceTheStart.filter(({ award }) => !later.has(award));
  };
  const from = daysAmong(decidedBy(since));
  const to = daysAmong(decidedBy(until));
  return from < to && to < daysToFinishTwoDays ? [{ name: onboardingGoalOf("two-days"), from, to, of: daysToFinishTwoDays }] : [];
}

async function twoDaysFactsOf(ctx: QueryCtx, member: MemberId, at: number): Promise<OnboardingQuestFacts> {
  const finish = await finishOf(ctx, member, "two-days");
  const progress = finish === null ? { done: await daysThankingOf(ctx, member, at), of: daysToFinishTwoDays, unit: "days" as const } : null;
  return { step: "two-days", finish, progress };
}

async function daysThankingOf(ctx: QueryCtx, member: MemberId, at: number): Promise<number> {
  const start = await questStartOf(ctx, member);
  if (start === null) return 0;
  return daysAmong(await givenBetween(ctx, member, start, at));
}

function daysAmong(given: DatedAward[]): number {
  return Math.min(new Set(given.map(({ day }) => day)).size, daysToFinishTwoDays);
}

export async function onboardingFinishedBy(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await onboardingFinishedAt(ctx, member)) !== null;
}

export async function onboardingFinishedAt(ctx: QueryCtx, member: MemberId): Promise<number | null> {
  let finishedAt = 0;
  for (const step of onboardingSteps) {
    const finish = await finishOf(ctx, member, step);
    if (finish === null) return null;
    finishedAt = Math.max(finishedAt, finish.at);
  }
  return finishedAt;
}

export async function onboardingQuestXpOf(ctx: QueryCtx, member: MemberId): Promise<number> {
  let xp = 0;
  for (const step of onboardingSteps) {
    const finish = await finishOf(ctx, member, step);
    if (finish !== null && isPaidOnTheMondayPath(finish)) xp += finish.xp;
  }
  return xp;
}

export async function advanceOnboarding(ctx: MutationCtx, event: KudosGivenEvent): Promise<FinishedOnboardingQuest[]> {
  const start = await questStartOf(ctx, event.giver);
  if (start === null || event.at < start) return [];
  const finished = [await advanceFirstThanks(ctx, event, start), await advanceSomeoneNew(ctx, event), await advanceTwoDays(ctx, event, start)];
  return finished.filter((quest) => quest !== null);
}

export async function onboardingMovedBy(ctx: QueryCtx, { giver, at }: KudosGivenEvent): Promise<MovedQuest[]> {
  const before = (await twoDaysFactsOf(ctx, giver, at - 1)).progress;
  const after = (await twoDaysFactsOf(ctx, giver, at)).progress;
  return before !== null && after !== null && after.done > before.done ? [{ goal: onboardingGoalOf("two-days"), progress: after }] : [];
}

export async function someoneNewWaitsOnTheMondayPath(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await questStartOf(ctx, member)) !== null && (await finishOf(ctx, member, "someone-new")) === null;
}

export async function finishSomeoneNewOnceEveryoneIsThanked(ctx: MutationCtx, workspace: string, member: MemberId, at: number): Promise<void> {
  const start = await questStartOf(ctx, member);
  if (start === null || at < start || (await finishOf(ctx, member, "someone-new")) !== null || !(await firstThanksCameBefore(ctx, member, start, at))) return;
  if (await hasThankedEveryone(ctx, workspace, member, at)) await finished(ctx, workspace, member, "someone-new", at);
}

async function firstThanksCameBefore(ctx: QueryCtx, member: MemberId, start: number, at: number): Promise<boolean> {
  const firstThanks = await finishOf(ctx, member, "first-thanks");
  if (firstThanks !== null) return firstThanks.at < at;
  return (await givenBetween(ctx, member, start, at - 1)).length > 0;
}

async function advanceFirstThanks(ctx: MutationCtx, event: KudosGivenEvent, start: number): Promise<FinishedOnboardingQuest | null> {
  if ((await finishOf(ctx, event.giver, "first-thanks")) === null) await payFirstThanksForTheEarliestKudos(ctx, event, start);
  const firstThanks = await finishOf(ctx, event.giver, "first-thanks");
  return firstThanks?.cause !== undefined && isSameMessage(firstThanks.cause, event.message) ? { step: "first-thanks", reward: onboardingReward } : null;
}

async function payFirstThanksForTheEarliestKudos(ctx: MutationCtx, { workspace, giver }: KudosGivenEvent, start: number): Promise<void> {
  const earliest = await firstGivenSince(ctx, giver, start);
  if (earliest !== null) await finished(ctx, workspace, giver, "first-thanks", earliest.at, earliest.message);
}

async function advanceSomeoneNew(ctx: MutationCtx, event: KudosGivenEvent): Promise<FinishedOnboardingQuest | null> {
  if ((await finishOf(ctx, event.giver, "someone-new")) !== null || !(await firstThanksPaidForAnotherMessage(ctx, event))) return null;
  const someoneNew = (await thanksSomeoneNew(ctx, event)) || (await hasThankedEveryone(ctx, event.workspace, event.giver, event.at));
  return someoneNew ? finishedBy(ctx, event, "someone-new") : null;
}

async function firstThanksPaidForAnotherMessage(ctx: QueryCtx, { giver, message }: KudosGivenEvent): Promise<boolean> {
  const firstThanks = await finishOf(ctx, giver, "first-thanks");
  return firstThanks !== null && (firstThanks.cause === undefined || !isSameMessage(firstThanks.cause, message));
}

async function thanksSomeoneNew(ctx: QueryCtx, { giver, awards }: KudosGivenEvent): Promise<boolean> {
  for (const { award, recipient } of awards) if ((await earliestAwardFrom(ctx, giver, recipient))?.award === award) return true;
  return false;
}

async function advanceTwoDays(ctx: MutationCtx, event: KudosGivenEvent, start: number): Promise<FinishedOnboardingQuest | null> {
  if ((await finishOf(ctx, event.giver, "two-days")) !== null) return null;
  const recorded = await recordedAtOf(ctx, event);
  const given = (await givenBetween(ctx, event.giver, start, Infinity)).filter(({ at, created }) => at <= event.at || created < recorded);
  const reachedAt = whenTheSecondDayCame([...given, event]);
  return reachedAt === null ? null : finished(ctx, event.workspace, event.giver, "two-days", Math.max(reachedAt, event.at), event.message);
}

function whenTheSecondDayCame(given: { day: string; at: number }[]): number | null {
  const days = new Set<string>();
  for (const { day, at } of given.toSorted((one, other) => one.at - other.at)) if (days.add(day).size === daysToFinishTwoDays) return at;
  return null;
}

async function recordedAtOf(ctx: QueryCtx, { awards }: KudosGivenEvent): Promise<number> {
  const first = awards[0] === undefined ? null : await ctx.db.get(awards[0].award);
  return first?._creationTime ?? 0;
}

function finishedBy(ctx: MutationCtx, { workspace, giver, at, message }: KudosGivenEvent, step: OnboardingStep): Promise<FinishedOnboardingQuest | null> {
  return finished(ctx, workspace, giver, step, at, message);
}

async function finished(ctx: MutationCtx, workspace: string, member: MemberId, step: OnboardingStep, at: number, cause?: MessageRef): Promise<FinishedOnboardingQuest | null> {
  const paid = await finishMondayQuest(ctx, workspace, member, { kind: "journey", step }, { reward: onboardingReward, catalogueVersion: mondayCatalogueVersion }, at, cause);
  return paid ? { step, reward: onboardingReward } : null;
}

async function twoDaysFinishedBy(ctx: QueryCtx, member: MemberId, instant: number): Promise<boolean> {
  const finish = await finishOf(ctx, member, "two-days");
  if (finish === null) return false;
  const decided = finish.cause === undefined ? null : await firstDecidedOf(ctx, finish.cause);
  return (decided ?? finish.at) <= instant;
}

function finishOf(ctx: QueryCtx, member: MemberId, step: OnboardingStep) {
  return rewardOf(ctx, member, rewardKeyOf({ kind: "journey", step }));
}
