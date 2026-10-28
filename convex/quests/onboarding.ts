import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { KudosGivenEvent } from "../bus/events";
import type { MessageRef } from "../engine/messageEvent";
import { earliestAwardFrom, firstAwardsGivenAfter, givenBetween } from "../engine/awards";
import { replyIsHeld } from "../feedback/heldReplies";
import { saysWhy } from "../progression/gate";
import { rewardOf, type RewardRecord } from "../progression/rewards";
import type { MemberId } from "../workspace/directory";
import { rewardKeyOf } from "./crates";
import { finishMondayQuest } from "./finish";
import { hasThankedEveryone, type Reward } from "./journey";
import { isPaidOnTheMondayPath, mondayCatalogueVersion } from "./mondayCatalogue";
import type { MovedQuest, QuestProgress } from "./progress";
import { questStartOf } from "./start";
import type { JourneyStep } from "./step";

export const onboardingSteps = ["first-thanks", "someone-new", "two-days"] as const satisfies readonly JourneyStep[];

export type OnboardingStep = (typeof onboardingSteps)[number];

export const onboardingReward: Reward = { xp: 50, coins: 0, item: null };

const daysSayingWhyToFinishTwoDays = 2;

const onboardingGoals: Record<OnboardingStep, string> = {
  "first-thanks": "Thank someone and say why",
  "someone-new": "Thank someone you haven't thanked before",
  "two-days": "Say why on 2 different days",
};

export type FinishedOnboardingQuest = { step: OnboardingStep; reward: Reward };

export type OnboardingQuest = { step: OnboardingStep; goal: string; finished: boolean; progress: QuestProgress | null };

export type OnboardingQuestFacts = { step: OnboardingStep; finish: RewardRecord | null; progress: QuestProgress | null };

export function onboardingGoalOf(step: OnboardingStep): string {
  return onboardingGoals[step];
}

export function onboardingTargetOf(step: OnboardingStep): number {
  return step === "two-days" ? daysSayingWhyToFinishTwoDays : 1;
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

async function twoDaysFactsOf(ctx: QueryCtx, member: MemberId, at: number): Promise<OnboardingQuestFacts> {
  const finish = await finishOf(ctx, member, "two-days");
  const progress = finish === null ? { done: await daysSayingWhyOf(ctx, member, at), of: daysSayingWhyToFinishTwoDays, unit: "days" as const } : null;
  return { step: "two-days", finish, progress };
}

async function daysSayingWhyOf(ctx: QueryCtx, member: MemberId, at: number): Promise<number> {
  const start = await questStartOf(ctx, member);
  if (start === null) return 0;
  const sayingWhy = (await givenBetween(ctx, member, start, at)).filter(({ annotations }) => saysWhy(annotations));
  return Math.min(new Set(sayingWhy.map(({ day }) => day)).size, daysSayingWhyToFinishTwoDays);
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
  const firstThanks = await advanceFirstThanks(ctx, event, await finishOf(ctx, event.giver, "first-thanks"));
  const someoneNewPostedAfter = firstThanks === null ? null : await finishSomeoneNewPostedAfter(ctx, event);
  const finished = [firstThanks, someoneNewPostedAfter, await advanceSomeoneNew(ctx, event, start), await advanceTwoDays(ctx, event, start)];
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
  return (await givenBetween(ctx, member, start, at - 1)).some(({ annotations }) => saysWhy(annotations));
}

async function advanceFirstThanks(ctx: MutationCtx, event: KudosGivenEvent, firstThanks: RewardRecord | null): Promise<FinishedOnboardingQuest | null> {
  return firstThanks === null && saysWhy(event.annotations) ? finishedBy(ctx, event, "first-thanks") : null;
}

async function finishSomeoneNewPostedAfter(ctx: MutationCtx, { workspace, giver, at }: KudosGivenEvent): Promise<FinishedOnboardingQuest | null> {
  if ((await finishOf(ctx, giver, "someone-new")) !== null) return null;
  for (const later of await firstAwardsGivenAfter(ctx, giver, at)) {
    if (!(await replyIsHeld(ctx, later.message))) return finished(ctx, workspace, giver, "someone-new", later.at, later.message);
  }
  return null;
}

async function advanceSomeoneNew(ctx: MutationCtx, event: KudosGivenEvent, start: number): Promise<FinishedOnboardingQuest | null> {
  if ((await finishOf(ctx, event.giver, "someone-new")) !== null || !(await firstThanksCameBefore(ctx, event.giver, start, event.at))) return null;
  const someoneNew = (await thanksSomeoneNew(ctx, event)) || (await hasThankedEveryone(ctx, event.workspace, event.giver, event.at));
  return someoneNew ? finishedBy(ctx, event, "someone-new") : null;
}

async function thanksSomeoneNew(ctx: QueryCtx, { giver, awards }: KudosGivenEvent): Promise<boolean> {
  for (const { award, recipient } of awards) if ((await earliestAwardFrom(ctx, giver, recipient))?.award === award) return true;
  return false;
}

async function advanceTwoDays(ctx: MutationCtx, event: KudosGivenEvent, start: number): Promise<FinishedOnboardingQuest | null> {
  if (!saysWhy(event.annotations) || (await finishOf(ctx, event.giver, "two-days")) !== null) return null;
  const recorded = await recordedAtOf(ctx, event);
  const sayingWhy = (await givenBetween(ctx, event.giver, start, Infinity)).filter(({ annotations, at, created }) => saysWhy(annotations) && (at <= event.at || created < recorded));
  const reachedAt = whenTheSecondDaySayingWhyCame([...sayingWhy, event]);
  return reachedAt === null ? null : finished(ctx, event.workspace, event.giver, "two-days", Math.max(reachedAt, event.at), event.message);
}

function whenTheSecondDaySayingWhyCame(sayingWhy: { day: string; at: number }[]): number | null {
  const days = new Set<string>();
  for (const { day, at } of sayingWhy.toSorted((one, other) => one.at - other.at)) if (days.add(day).size === daysSayingWhyToFinishTwoDays) return at;
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

function finishOf(ctx: QueryCtx, member: MemberId, step: OnboardingStep) {
  return rewardOf(ctx, member, rewardKeyOf({ kind: "journey", step }));
}
