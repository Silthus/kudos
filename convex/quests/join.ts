import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { republish } from "../feedback/homes";
import { notifyJourneyJoined } from "../feedback/notify";
import { gaveThoughtfulKudos } from "../progression/effects";
import { openedAtOf } from "../unlocks/unlocks";
import type { MemberId } from "../workspace/directory";
import { activated, finishedOnActivation, finishSilently, journey, journeyStepsApplyingIn, type JourneyActivation } from "./journey";
import { featureOpening, type JourneyQuest, type JourneyStep } from "./step";

const membersPerPage = 100;

export const joinJourneyPage = internalMutation({
  args: { launch: v.id("journeyLaunches"), cursor: v.optional(v.string()) },
  handler: async (ctx, { launch, cursor }) => {
    const { workspace, at, _creationTime: launchedAt } = (await ctx.db.get(launch))!;
    const people = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", workspace))
      .paginate({ numItems: membersPerPage, cursor: cursor ?? null });
    for (const { _id: member, kind, _creationTime } of people.page) {
      if (kind === "member" && _creationTime < launchedAt) await ctx.scheduler.runAfter(0, internal.quests.join.joinJourney, { workspace, at, member });
    }
    if (!people.isDone) await ctx.scheduler.runAfter(0, internal.quests.join.joinJourneyPage, { launch, cursor: people.continueCursor });
  },
});

export const joinJourney = internalMutation({
  args: { workspace: v.string(), at: v.number(), member: v.id("members") },
  handler: async (ctx, { workspace, at, member }) => {
    const finished: Array<{ quest: JourneyQuest; xp: number }> = [];
    for (const step of await journeyStepsApplyingIn(ctx, workspace)) {
      const activation = await activatedIfOpened(ctx, workspace, member, step, at);
      const finishedAt = activation === null ? null : await finishedAtJoin(ctx, workspace, activation, at);
      if (activation !== null && finishedAt !== null && (await finishSilently(ctx, workspace, activation, finishedAt))) finished.push({ quest: { kind: "journey", step }, xp: activation.reward.xp });
    }
    if (finished.length === 0) return;
    await notifyJourneyJoined(ctx, member, finished);
    await republish(ctx, member);
  },
});

async function activatedIfOpened(ctx: MutationCtx, workspace: string, member: MemberId, step: JourneyStep, at: number): Promise<JourneyActivation | null> {
  const feature = featureOpening(step);
  const openedAt = feature === null ? at : await openedAtOf(ctx, member, feature);
  return openedAt !== null && openedAt <= at ? activated(ctx, workspace, member, step, at, journey) : null;
}

async function finishedAtJoin(ctx: MutationCtx, workspace: string, activation: JourneyActivation, at: number): Promise<number | null> {
  if (activation.step !== "first-thanks") return finishedOnActivation(ctx, workspace, activation);
  return (await gaveThoughtfulKudos(ctx, activation.member, at)) ? at : null;
}
