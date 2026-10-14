import { v, type Infer } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { publish } from "../bus/publish";
import {
  memberLeftEventValidator,
  memberRejoinedEventValidator,
  questFinishedEventValidator,
  unlockOpenedEventValidator,
  type KudosGivenEvent,
} from "../bus/events";
import type { DayKey } from "../engine/allowance";
import type { MessageRef } from "../engine/messageEvent";
import { firstThanksOf, givenBetween, lastThankedBefore, lastThankedBy, type DatedAward } from "../engine/awards";
import { republish } from "../feedback/homes";
import { notifyQuestFinished } from "../feedback/notify";
import { gateDecisionOf } from "../progression/gate";
import { rewardOf, rewardsKeyedFrom } from "../progression/rewards";
import { openedAtOf } from "../unlocks/unlocks";
import { chatUserOf, teammatesOf, type MemberId } from "../workspace/directory";
import { crateOpeningOf, rewardKeyOf, rewardKeyPrefixOf } from "./crates";
import { finishQuest } from "./finish";
import { journeyStartedFor, journeyStepAppliesIn, questsLiveFor } from "./flag";
import { featureOpening, journeyStepOpenedBy, journeyStepValidator, type JourneyQuest, type JourneyStep } from "./step";

export const rewardValidator = v.object({ xp: v.number(), coins: v.number(), item: v.null() });

export type Reward = Infer<typeof rewardValidator>;

export type JourneyCatalogue = { version: string; steps: ReadonlyArray<{ step: JourneyStep; reward: Reward }> };

export const journey = {
  version: "1",
  steps: [
    { step: "first-thanks", reward: { xp: 10, coins: 0, item: null } },
    { step: "first-quest", reward: { xp: 20, coins: 0, item: null } },
    { step: "someone-new", reward: { xp: 30, coins: 0, item: null } },
    { step: "two-days", reward: { xp: 30, coins: 0, item: null } },
  ],
} as const satisfies JourneyCatalogue;

export const journeyActivationValidator = v.object({
  member: v.id("members"),
  step: journeyStepValidator,
  activatedAt: v.number(),
  reward: rewardValidator,
  catalogueVersion: v.string(),
  sayingWhy: v.optional(v.object({ day: v.string(), at: v.number() })),
});

export type JourneyActivation = Infer<typeof journeyActivationValidator>;

const membersPerRecheck = 100;

const daysSayingWhyToFinishTwoDays = 2;

export const activateJourney = internalMutation({
  args: { event: unlockOpenedEventValidator },
  handler: async (ctx, { event: { workspace, member, feature, at } }) => {
    const step = journeyStepOpenedBy(feature);
    if (step === null || !(await questsLiveFor(ctx, member)) || !(await journeyStepAppliesIn(ctx, workspace, step)) || (await isLeftToTheJoin(ctx, member, at))) return;
    if (await activateOpened(ctx, workspace, member, step, at)) await republish(ctx, member);
  },
});

export const finishFirstQuest = internalMutation({
  args: { event: questFinishedEventValidator },
  handler: async (ctx, { event: { workspace, member, quest, at } }) => {
    if (quest.kind === "weekly" && (await questsLiveFor(ctx, member))) await finishFirstQuestOnWeeklyFinished(ctx, workspace, member, at);
  },
});

export const recheckSomeoneNew = internalMutation({
  args: { event: memberLeftEventValidator, cursor: v.optional(v.string()) },
  handler: async (ctx, { event, cursor }) => {
    const people = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", event.workspace))
      .paginate({ numItems: membersPerRecheck, cursor: cursor ?? null });
    for (const { _id: member, kind } of people.page) {
      if (kind === "member" && (await isUnfinished(ctx, member, "someone-new"))) await recheckLater(ctx, event.workspace, member, event.at);
    }
    if (!people.isDone) await ctx.scheduler.runAfter(0, internal.quests.journey.recheckSomeoneNew, { event, cursor: people.continueCursor });
  },
});

export const recheckRejoined = internalMutation({
  args: { event: memberRejoinedEventValidator },
  handler: async (ctx, { event: { workspace, member, at } }) => {
    if (await isUnfinished(ctx, member, "someone-new")) await recheckLater(ctx, workspace, member, at);
  },
});

export const recheckSomeoneNewOf = internalMutation({
  args: { workspace: v.string(), member: v.id("members"), at: v.number() },
  handler: async (ctx, { workspace, member, at }) => {
    if (!(await questsLiveFor(ctx, member))) return;
    const someoneNew = await activationOf(ctx, member, "someone-new");
    if (someoneNew !== null) await finishOnceEveryoneIsThanked(ctx, workspace, someoneNew, at);
  },
});

export async function advanceJourney(ctx: MutationCtx, event: KudosGivenEvent, catalogue: JourneyCatalogue): Promise<JourneyActivation[]> {
  const finished = [await advanceFirstThanks(ctx, event, catalogue), await advanceSomeoneNew(ctx, event), await advanceTwoDays(ctx, event)];
  return finished.filter((step) => step !== null);
}

export async function journeyStepsApplyingIn(ctx: QueryCtx, workspace: string): Promise<JourneyStep[]> {
  const steps: JourneyStep[] = [];
  for (const { step } of journey.steps) if (await journeyStepAppliesIn(ctx, workspace, step)) steps.push(step);
  return steps;
}

export async function finishFirstQuestOnWeeklyFinished(ctx: MutationCtx, workspace: string, member: MemberId, at: number, cause?: MessageRef): Promise<JourneyActivation | null> {
  const firstQuest = await activationOf(ctx, member, "first-quest");
  return firstQuest !== null && firstQuest.activatedAt <= at ? finishedOrNull(ctx, workspace, firstQuest, at, cause) : null;
}

async function advanceFirstThanks(ctx: MutationCtx, event: KudosGivenEvent, catalogue: JourneyCatalogue): Promise<JourneyActivation | null> {
  const firstThanks = await activated(ctx, event.workspace, event.giver, "first-thanks", event.at, catalogue);
  return gateDecisionOf(event.annotations)?.thoughtful === true ? finishedOrNull(ctx, event.workspace, firstThanks, event.at, event.message) : null;
}

async function advanceSomeoneNew(ctx: MutationCtx, event: KudosGivenEvent): Promise<JourneyActivation | null> {
  const someoneNew = await activationOf(ctx, event.giver, "someone-new");
  if (someoneNew === null || event.at < someoneNew.activatedAt || (await isFinished(ctx, someoneNew))) return null;
  const lastThanked = await lastThankedBefore(ctx, event.awards);
  return [...lastThanked.values()].includes(null) ? finishedOrNull(ctx, event.workspace, someoneNew, event.at, event.message) : null;
}

async function finishedOrNull(ctx: MutationCtx, workspace: string, activation: JourneyActivation, at: number, cause?: MessageRef): Promise<JourneyActivation | null> {
  return (await finish(ctx, workspace, activation, at, cause)) ? activation : null;
}

async function advanceTwoDays(ctx: MutationCtx, event: KudosGivenEvent): Promise<JourneyActivation | null> {
  const twoDays = await activationOf(ctx, event.giver, "two-days");
  if (twoDays === null || event.at < twoDays.activatedAt || gateDecisionOf(event.annotations)?.thoughtful !== true) return null;
  if (!(await journeyStepAppliesIn(ctx, event.workspace, "two-days")) || (await isFinished(ctx, twoDays))) return null;
  const counted = twoDays.sayingWhy;
  const days = new Set<DayKey>([event.day, ...(counted === undefined ? [] : [counted.day]), ...(await daysSayingWhyBeforeActivation(ctx, twoDays, event.at))]);
  if (days.size >= daysSayingWhyToFinishTwoDays) return finishedOrNull(ctx, event.workspace, twoDays, Math.max(event.at, counted?.at ?? event.at), event.message);
  if (counted === undefined) await ctx.db.patch(twoDays._id, { sayingWhy: { day: event.day, at: event.at } });
  return null;
}

async function daysSayingWhyBeforeActivation(ctx: QueryCtx, activation: Doc<"journeySteps">, until: number): Promise<DayKey[]> {
  return (await sayingWhyBetween(ctx, activation, Math.min(until, activation._creationTime))).map(({ day }) => day);
}

async function isLeftToTheJoin(ctx: QueryCtx, member: MemberId, openedAt: number) {
  return openedAt < (await journeyStartedFor(ctx, member))!;
}

async function recheckLater(ctx: MutationCtx, workspace: string, member: MemberId, at: number) {
  await ctx.scheduler.runAfter(0, internal.quests.journey.recheckSomeoneNewOf, { workspace, member, at });
}

export async function finishedOnActivation(ctx: QueryCtx, workspace: string, activation: JourneyActivation): Promise<number | null> {
  switch (activation.step) {
    case "first-thanks":
      return null;
    case "first-quest":
      return firstWeeklyQuestFinishedSince(ctx, activation);
    case "someone-new":
      return (await firstThanksSince(ctx, activation)) ?? ((await hasThankedEveryone(ctx, workspace, activation.member, activation.activatedAt)) ? activation.activatedAt : null);
    case "two-days":
      return secondDaySayingWhyOf(await sayingWhyBetween(ctx, activation, Infinity));
  }
}

async function sayingWhyBetween(ctx: QueryCtx, { member, activatedAt }: JourneyActivation, until: number): Promise<DatedAward[]> {
  return (await givenBetween(ctx, member, activatedAt, until)).filter(({ annotations }) => gateDecisionOf(annotations)?.thoughtful === true);
}

function secondDaySayingWhyOf(sayingWhy: DatedAward[]): number | null {
  const days = new Set<DayKey>();
  for (const { day, at } of sayingWhy) {
    days.add(day);
    if (days.size === daysSayingWhyToFinishTwoDays) return at;
  }
  return null;
}

async function firstWeeklyQuestFinishedSince(ctx: QueryCtx, { member, activatedAt }: JourneyActivation): Promise<number | null> {
  const weekly = await rewardsKeyedFrom(ctx, member, rewardKeyPrefixOf("weekly"));
  return earliest(weekly.map(({ at }) => at).filter((at) => at >= activatedAt));
}

async function firstThanksSince(ctx: QueryCtx, { member, activatedAt }: JourneyActivation): Promise<number | null> {
  return earliest((await firstThanksOf(ctx, member)).filter((at) => at >= activatedAt));
}

function earliest(times: number[]): number | null {
  return times.length === 0 ? null : Math.min(...times);
}

async function isUnfinished(ctx: QueryCtx, member: MemberId, step: JourneyStep) {
  const activation = await activationOf(ctx, member, step);
  return activation !== null && !(await isFinished(ctx, activation));
}

async function finishOnceEveryoneIsThanked(ctx: MutationCtx, workspace: string, someoneNew: JourneyActivation, at: number) {
  if (!(await isFinished(ctx, someoneNew)) && (await hasThankedEveryone(ctx, workspace, someoneNew.member, at))) await finish(ctx, workspace, someoneNew, at);
}

async function hasThankedEveryone(ctx: QueryCtx, workspace: string, member: MemberId, at: number) {
  const thanked = await lastThankedBy(ctx, member, at);
  const teammates = await teammatesOf(ctx, workspace, member);
  return teammates.every((teammate) => thanked.has(teammate));
}

async function isFinished(ctx: QueryCtx, { member, step }: JourneyActivation) {
  return (await rewardOf(ctx, member, rewardKeyOf({ kind: "journey", step }))) !== null;
}

export type JourneyStepFacts = Omit<JourneyActivation, "member"> & { finishedAt: number | null; openedAt: number | null };

export async function journeyOf(ctx: QueryCtx, member: MemberId): Promise<JourneyStepFacts[]> {
  const { workspace } = await chatUserOf(ctx, member);
  const facts: JourneyStepFacts[] = [];
  for (const step of await journeyStepsApplyingIn(ctx, workspace)) {
    const activation = await activationOf(ctx, member, step);
    if (activation === null) continue;
    const { activatedAt, reward, catalogueVersion } = activation;
    const key = rewardKeyOf({ kind: "journey", step });
    const finish = await rewardOf(ctx, member, key);
    const opening = await crateOpeningOf(ctx, member, key);
    facts.push({ step, activatedAt, reward, catalogueVersion, finishedAt: finish?.at ?? null, openedAt: opening?.at ?? null });
  }
  return facts;
}

export type ProjectedJourneyStep = Omit<JourneyStepFacts, "activatedAt"> & { activatedAt: number | null; crate: JourneyQuest };

export async function projectedJourneyOf(ctx: QueryCtx, member: MemberId): Promise<ProjectedJourneyStep[]> {
  const stored = await journeyOf(ctx, member);
  const steps = stored.some(({ step }) => step === "first-thanks") ? stored : [firstThanksBeforeActivation(journey), ...stored];
  return steps.map((step) => ({ ...step, crate: { kind: "journey", step: step.step } }));
}

function firstThanksBeforeActivation({ version, steps }: JourneyCatalogue): Omit<ProjectedJourneyStep, "crate"> {
  const { reward } = steps.find(({ step }) => step === "first-thanks")!;
  return { step: "first-thanks", activatedAt: null, reward, catalogueVersion: version, finishedAt: null, openedAt: null };
}

export async function activateJourneyOf(ctx: MutationCtx, member: MemberId): Promise<void> {
  const { workspace } = await chatUserOf(ctx, member);
  await activated(ctx, workspace, member, "first-thanks", Date.now(), journey);
  await activateOpenedSteps(ctx, workspace, member);
}

async function activateOpenedSteps(ctx: MutationCtx, workspace: string, member: MemberId) {
  const startedAt = (await journeyStartedFor(ctx, member))!;
  for (const step of await journeyStepsApplyingIn(ctx, workspace)) {
    const feature = featureOpening(step);
    const openedAt = feature === null ? null : await openedAtOf(ctx, member, feature);
    if (openedAt === null) continue;
    if (openedAt > startedAt) await activateOpened(ctx, workspace, member, step, openedAt);
    else if (step === "two-days") await activateOpened(ctx, workspace, member, step, Date.now());
  }
}

async function activateOpened(ctx: MutationCtx, workspace: string, member: MemberId, step: JourneyStep, at: number): Promise<boolean> {
  if ((await activationOf(ctx, member, step)) !== null) return false;
  const activation = await activated(ctx, workspace, member, step, at, journey);
  const finishedAt = await finishedOnActivation(ctx, workspace, activation);
  if (finishedAt !== null) await finish(ctx, workspace, activation, finishedAt);
  return true;
}

export async function activated(ctx: MutationCtx, workspace: string, member: MemberId, step: JourneyStep, at: number, catalogue: JourneyCatalogue): Promise<JourneyActivation> {
  const stored = await activationOf(ctx, member, step);
  if (stored !== null) return stored;
  const { reward } = catalogue.steps.find((entry) => entry.step === step)!;
  const activation = { member, step, activatedAt: at, reward, catalogueVersion: catalogue.version };
  await ctx.db.insert("journeySteps", activation);
  await publish(ctx, { type: "journeyStepActivated", workspace, member, step, at });
  return activation;
}

async function finish(ctx: MutationCtx, workspace: string, activation: JourneyActivation, at: number, cause?: MessageRef): Promise<boolean> {
  if (!(await finishSilently(ctx, workspace, activation, at, cause))) return false;
  await notifyQuestFinished(ctx, activation.member, { kind: "journey", step: activation.step }, activation.reward.xp);
  return true;
}

export function finishSilently(ctx: MutationCtx, workspace: string, { member, step, reward, catalogueVersion }: JourneyActivation, at: number, cause?: MessageRef): Promise<boolean> {
  return finishQuest(ctx, workspace, member, { kind: "journey", step }, { reward, catalogueVersion }, at, cause);
}

function activationOf(ctx: QueryCtx, member: MemberId, step: JourneyStep) {
  return ctx.db
    .query("journeySteps")
    .withIndex("by_member_step", (q) => q.eq("member", member).eq("step", step))
    .unique();
}
