import { v, type Infer } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { kudosGivenEventValidator, type KudosGivenEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { notifyQuestFinished } from "../feedback/notify";
import { gateDecisionOf } from "../progression/gate";
import { recordReward } from "../progression/progression";
import { rewardOf } from "../progression/rewards";
import type { MemberId } from "../workspace/directory";
import { crateOpeningOf, rewardKeyOf } from "./crates";
import { questsApplyIn } from "./flag";
import { journeyStepValidator, type JourneyStep, type Quest } from "./step";

const rewardValidator = v.object({ xp: v.number(), coins: v.number(), item: v.null() });

export type Reward = Infer<typeof rewardValidator>;

export type JourneyCatalogue = { version: string; steps: ReadonlyArray<{ step: JourneyStep; reward: Reward }> };

export const journey = {
  version: "1",
  steps: [{ step: "first-thanks", reward: { xp: 10, coins: 0, item: null } }],
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

export async function advanceJourney(ctx: MutationCtx, event: KudosGivenEvent, catalogue: JourneyCatalogue): Promise<void> {
  if (!(await questsApplyIn(ctx, event.workspace))) return;
  const firstThanks = await activated(ctx, event.giver, "first-thanks", event.at, catalogue);
  if (gateDecisionOf(event.annotations)?.thoughtful !== true) return;
  await finish(ctx, event.workspace, firstThanks, event.at);
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
  const quest: Quest = { kind: "journey", step };
  const recorded = await recordReward(ctx, workspace, { member, key: rewardKeyOf(quest), ...reward, catalogueVersion, at });
  if (recorded !== "recorded") return;
  await publish(ctx, { type: "questFinished", workspace, member, quest, at });
  await notifyQuestFinished(ctx, member, quest, reward.xp);
}

function activationOf(ctx: QueryCtx, member: MemberId, step: JourneyStep) {
  return ctx.db
    .query("journeySteps")
    .withIndex("by_member_step", (q) => q.eq("member", member).eq("step", step))
    .unique();
}
