import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { KudosGivenEvent } from "../bus/events";
import { givenBetween, lastThankedBefore, lastThankedBy } from "../engine/awards";
import { gateDecisionOf } from "../progression/gate";
import { rewardOf, type RewardRecord } from "../progression/rewards";
import { teammatesOf, type MemberId } from "../workspace/directory";
import { rewardKeyOf } from "./crates";
import { finishMondayQuest } from "./finish";
import type { Reward } from "./journey";
import { isPaidOnTheMondayPath, mondayCatalogueVersion } from "./mondayCatalogue";
import type { QuestProgress } from "./progress";
import { questStartOf } from "./start";
import type { JourneyStep } from "./step";

export const onboardingSteps = ["first-thanks", "someone-new", "two-days"] as const satisfies readonly JourneyStep[];

export type OnboardingStep = (typeof onboardingSteps)[number];

const onboardingReward: Reward = { xp: 50, coins: 0, item: null };

const daysSayingWhyToFinishTwoDays = 2;

const onboardingGoals: Record<OnboardingStep, string> = {
  "first-thanks": "Thank someone and say why",
  "someone-new": "Thank someone you haven't thanked before",
  "two-days": "Say why on 2 different days",
};

export type FinishedOnboardingQuest = { step: OnboardingStep; reward: Reward };

export type OnboardingQuest = { step: OnboardingStep; goal: string; finished: boolean; progress: QuestProgress | null };

export function onboardingGoalOf(step: OnboardingStep): string {
  return onboardingGoals[step];
}

export function isOnboardingStep(step: JourneyStep): step is OnboardingStep {
  return (onboardingSteps as readonly JourneyStep[]).includes(step);
}

export async function nextOnboardingQuestOf(ctx: QueryCtx, member: MemberId): Promise<OnboardingStep | null> {
  for (const step of onboardingSteps) if ((await finishOf(ctx, member, step)) === null) return step;
  return null;
}

export async function onboardingQuestsOf(ctx: QueryCtx, member: MemberId, at: number): Promise<OnboardingQuest[]> {
  const quests: OnboardingQuest[] = [];
  for (const step of onboardingSteps) {
    const finished = (await finishOf(ctx, member, step)) !== null;
    const progress = step === "two-days" && !finished ? { done: await daysSayingWhyOf(ctx, member, at), of: daysSayingWhyToFinishTwoDays, unit: "days" as const } : null;
    quests.push({ step, goal: onboardingGoalOf(step), finished, progress });
  }
  return quests;
}

async function daysSayingWhyOf(ctx: QueryCtx, member: MemberId, at: number): Promise<number> {
  const start = await questStartOf(ctx, member);
  if (start === null) return 0;
  const sayingWhy = (await givenBetween(ctx, member, start, at)).filter(({ annotations }) => gateDecisionOf(annotations)?.thoughtful === true);
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
  const firstThanks = await finishOf(ctx, event.giver, "first-thanks");
  const finished = [await advanceFirstThanks(ctx, event), await advanceSomeoneNew(ctx, event, firstThanks), await advanceTwoDays(ctx, event, start)];
  return finished.filter((quest) => quest !== null);
}

async function advanceFirstThanks(ctx: MutationCtx, event: KudosGivenEvent): Promise<FinishedOnboardingQuest | null> {
  return saysWhy(event) ? finished(ctx, event, "first-thanks") : null;
}

async function advanceSomeoneNew(ctx: MutationCtx, event: KudosGivenEvent, firstThanks: RewardRecord | null): Promise<FinishedOnboardingQuest | null> {
  if (firstThanks === null || event.at <= firstThanks.at) return null;
  const lastThanked = await lastThankedBefore(ctx, event.awards);
  const thanksSomeoneNew = [...lastThanked.values()].includes(null) || (await hasThankedEveryone(ctx, event));
  return thanksSomeoneNew ? finished(ctx, event, "someone-new") : null;
}

async function advanceTwoDays(ctx: MutationCtx, event: KudosGivenEvent, start: number): Promise<FinishedOnboardingQuest | null> {
  if (!saysWhy(event)) return null;
  const sayingWhy = (await givenBetween(ctx, event.giver, start, event.at)).filter(({ annotations }) => gateDecisionOf(annotations)?.thoughtful === true);
  const days = new Set([event.day, ...sayingWhy.map(({ day }) => day)]);
  return days.size >= daysSayingWhyToFinishTwoDays ? finished(ctx, event, "two-days") : null;
}

async function finished(ctx: MutationCtx, { workspace, giver, at, message }: KudosGivenEvent, step: OnboardingStep): Promise<FinishedOnboardingQuest | null> {
  const paid = await finishMondayQuest(ctx, workspace, giver, { kind: "journey", step }, { reward: onboardingReward, catalogueVersion: mondayCatalogueVersion }, at, message);
  return paid ? { step, reward: onboardingReward } : null;
}

async function hasThankedEveryone(ctx: QueryCtx, { workspace, giver, at }: KudosGivenEvent): Promise<boolean> {
  const thanked = await lastThankedBy(ctx, giver, at);
  return (await teammatesOf(ctx, workspace, giver)).every((teammate) => thanked.has(teammate));
}

function saysWhy({ annotations }: KudosGivenEvent): boolean {
  return gateDecisionOf(annotations)?.thoughtful === true;
}

function finishOf(ctx: QueryCtx, member: MemberId, step: OnboardingStep) {
  return rewardOf(ctx, member, rewardKeyOf({ kind: "journey", step }));
}
