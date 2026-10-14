import { type Infer } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import {
  kudosGivenEventValidator,
  memberLeftEventValidator,
  memberRejoinedEventValidator,
  questFinishedEventValidator,
  unlockOpenedEventValidator,
  type KudosGivenEvent,
} from "../bus/events";
import { firstThanksOf, lastThankedBefore, lastThankedBy } from "../engine/awards";
import { republish } from "../feedback/homes";
import { notifyQuestFinished } from "../feedback/notify";
import { gateDecisionOf } from "../progression/gate";
import { rewardOf, rewardsKeyedFrom } from "../progression/rewards";
import { teammatesOf, type MemberId } from "../workspace/directory";
import { crateOpeningOf, rewardKeyOf, rewardKeyPrefixOf } from "./crates";
import { finishQuest } from "./finish";
import { questsApplyIn } from "./flag";
import { journeyStepOpenedBy, journeyStepValidator, type JourneyQuest, type JourneyStep } from "./step";

export const rewardValidator = v.object({ xp: v.number(), coins: v.number(), item: v.null() });

export type Reward = Infer<typeof rewardValidator>;

export type JourneyCatalogue = { version: string; steps: ReadonlyArray<{ step: JourneyStep; reward: Reward }> };

export const journey = {
  version: "1",
  steps: [
    { step: "first-thanks", reward: { xp: 10, coins: 0, item: null } },
    { step: "first-quest", reward: { xp: 20, coins: 0, item: null } },
    { step: "someone-new", reward: { xp: 30, coins: 0, item: null } },
  ],
} as const satisfies JourneyCatalogue;

export const journeyActivationValidator = v.object({
  member: v.id("members"),
  step: journeyStepValidator,
  activatedAt: v.number(),
  reward: rewardValidator,
  catalogueVersion: v.string(),
});

export type JourneyActivation = Infer<typeof journeyActivationValidator>;

export const followJourney = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: (ctx, { event }) => advanceJourney(ctx, event, journey),
});

const membersPerRecheck = 100;

export const activateJourney = internalMutation({
  args: { event: unlockOpenedEventValidator },
  handler: async (ctx, { event: { workspace, member, feature, at } }) => {
    const step = journeyStepOpenedBy(feature);
    if (step === null || !(await questsApplyIn(ctx, workspace)) || (await activationOf(ctx, member, step)) !== null) return;
    const activation = await activated(ctx, member, step, at, journey);
    await finishWithWhatFollowed(ctx, workspace, activation);
    if (step === "someone-new") await finishOnceEveryoneIsThanked(ctx, workspace, activation, at);
    await republish(ctx, member);
  },
});

export const finishFirstQuest = internalMutation({
  args: { event: questFinishedEventValidator },
  handler: async (ctx, { event: { workspace, member, quest, at } }) => {
    if (quest.kind !== "weekly" || !(await questsApplyIn(ctx, workspace))) return;
    const firstQuest = await activationOf(ctx, member, "first-quest");
    if (firstQuest !== null && firstQuest.activatedAt <= at) await finish(ctx, workspace, firstQuest, at);
  },
});

export const recheckSomeoneNew = internalMutation({
  args: { event: memberLeftEventValidator, cursor: v.optional(v.string()) },
  handler: async (ctx, { event, cursor }) => {
    if (!(await questsApplyIn(ctx, event.workspace))) return;
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
    if (!(await questsApplyIn(ctx, workspace))) return;
    const someoneNew = await activationOf(ctx, member, "someone-new");
    if (someoneNew !== null) await finishOnceEveryoneIsThanked(ctx, workspace, someoneNew, at);
  },
});

export async function advanceJourney(ctx: MutationCtx, event: KudosGivenEvent, catalogue: JourneyCatalogue): Promise<void> {
  if (!(await questsApplyIn(ctx, event.workspace))) return;
  await advanceFirstThanks(ctx, event, catalogue);
  await advanceSomeoneNew(ctx, event);
}

async function advanceFirstThanks(ctx: MutationCtx, event: KudosGivenEvent, catalogue: JourneyCatalogue) {
  const firstThanks = await activated(ctx, event.giver, "first-thanks", event.at, catalogue);
  if (gateDecisionOf(event.annotations)?.thoughtful === true) await finish(ctx, event.workspace, firstThanks, event.at);
}

async function advanceSomeoneNew(ctx: MutationCtx, event: KudosGivenEvent) {
  const someoneNew = await activationOf(ctx, event.giver, "someone-new");
  if (someoneNew === null || event.at < someoneNew.activatedAt || (await isFinished(ctx, someoneNew))) return;
  const lastThanked = await lastThankedBefore(ctx, event.awards);
  if ([...lastThanked.values()].includes(null)) await finish(ctx, event.workspace, someoneNew, event.at);
}

async function recheckLater(ctx: MutationCtx, workspace: string, member: MemberId, at: number) {
  await ctx.scheduler.runAfter(0, internal.quests.journey.recheckSomeoneNewOf, { workspace, member, at });
}

async function finishWithWhatFollowed(ctx: MutationCtx, workspace: string, activation: JourneyActivation) {
  const at = activation.step === "first-quest" ? await firstWeeklyQuestFinishedSince(ctx, activation) : activation.step === "someone-new" ? await firstThanksSince(ctx, activation) : null;
  if (at !== null) await finish(ctx, workspace, activation, at);
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
  if (await isFinished(ctx, someoneNew)) return;
  const thanked = await lastThankedBy(ctx, someoneNew.member, at);
  const teammates = await teammatesOf(ctx, workspace, someoneNew.member);
  if (teammates.every((teammate) => thanked.has(teammate))) await finish(ctx, workspace, someoneNew, at);
}

async function isFinished(ctx: QueryCtx, { member, step }: JourneyActivation) {
  return (await rewardOf(ctx, member, rewardKeyOf({ kind: "journey", step }))) !== null;
}

export type JourneyStepFacts = Omit<JourneyActivation, "member"> & { finishedAt: number | null; openedAt: number | null };

export async function journeyOf(ctx: QueryCtx, member: MemberId): Promise<JourneyStepFacts[]> {
  const facts: JourneyStepFacts[] = [];
  for (const { step } of journey.steps) {
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

export async function activeJourneyOf(ctx: MutationCtx, member: MemberId): Promise<JourneyStepFacts[]> {
  await activated(ctx, member, "first-thanks", Date.now(), journey);
  return journeyOf(ctx, member);
}

async function activated(ctx: MutationCtx, member: MemberId, step: JourneyStep, at: number, catalogue: JourneyCatalogue): Promise<JourneyActivation> {
  const stored = await activationOf(ctx, member, step);
  if (stored !== null) return stored;
  const { reward } = catalogue.steps.find((entry) => entry.step === step)!;
  const activation = { member, step, activatedAt: at, reward, catalogueVersion: catalogue.version };
  await ctx.db.insert("journeySteps", activation);
  return activation;
}

async function finish(ctx: MutationCtx, workspace: string, { member, step, reward, catalogueVersion }: JourneyActivation, at: number) {
  const quest: JourneyQuest = { kind: "journey", step };
  if (await finishQuest(ctx, workspace, member, quest, { reward, catalogueVersion }, at)) await notifyQuestFinished(ctx, member, quest, reward.xp);
}

function activationOf(ctx: QueryCtx, member: MemberId, step: JourneyStep) {
  return ctx.db
    .query("journeySteps")
    .withIndex("by_member_step", (q) => q.eq("member", member).eq("step", step))
    .unique();
}
