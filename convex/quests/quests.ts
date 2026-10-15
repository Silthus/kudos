import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { kudosGivenEventValidator, type KudosGivenEvent } from "../bus/events";
import { releaseSuccessReply, type QuestDone } from "../feedback/replies";
import type { MemberId } from "../workspace/directory";
import { rewardKeyOf, rewardWaits } from "./crates";
import { questsApplyTo, questsShownTo } from "./flag";
import { advanceJourney, finishFirstQuestOnWeeklyFinished, journey, journeyOf, type JourneyStepFacts, type Reward } from "./journey";
import type { Quest } from "./step";
import { advanceWeeklyQuests, weeklyQuestsOf, type WeeklyQuests } from "./weekly";

export type QuestFacts = { journey: JourneyStepFacts[]; week: WeeklyQuests | null };

export const questsOf = internalQuery({
  args: { member: v.id("members") },
  handler: async (ctx, { member }): Promise<QuestFacts | null> => {
    if (!(await questsApplyTo(ctx, member))) return null;
    return { journey: await journeyOf(ctx, member), week: await weeklyQuestsOf(ctx, member, Date.now()) };
  },
});

export const followKudosGiven = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: async (ctx, { event }) => {
    const questsDone = (await questsShownTo(ctx, event.giver)) ? await questsFinishedBy(ctx, event) : [];
    await releaseSuccessReply(ctx, event.message, questsDone);
  },
});

async function questsFinishedBy(ctx: MutationCtx, event: KudosGivenEvent): Promise<QuestDone[]> {
  const weekly = await advanceWeeklyQuests(ctx, event);
  const steps = await advanceJourney(ctx, event, journey);
  const firstQuest = weekly.length === 0 ? null : await finishFirstQuestOnWeeklyFinished(ctx, event.workspace, event.giver, event.at, event.message);
  if (firstQuest !== null) steps.push(firstQuest);
  const done: QuestDone[] = [];
  for (const { crate, goal, reward } of weekly) done.push({ kind: "weekly", goal, ...(await gainsOf(ctx, event.giver, crate, reward)) });
  for (const { step, reward } of steps) done.push({ kind: "journey", step, ...(await gainsOf(ctx, event.giver, { kind: "journey", step }, reward)) });
  return done;
}

async function gainsOf(ctx: MutationCtx, member: MemberId, quest: Quest, { xp, coins }: Reward) {
  const key = rewardKeyOf(quest);
  return { xp, ...(coins > 0 && { coins }), ...((await rewardWaits(ctx, member, key)) && { heldRewardKey: key }) };
}
