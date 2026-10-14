import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { kudosGivenEventValidator, type KudosGivenEvent } from "../bus/events";
import { releaseSuccessReply, type QuestDone } from "../feedback/replies";
import { questsApplyTo, questsShownTo } from "./flag";
import { advanceJourney, finishFirstQuestOnWeeklyFinished, journey, journeyOf, type JourneyStepFacts, type Reward } from "./journey";
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
  return [
    ...weekly.map(({ goal, reward }): QuestDone => ({ kind: "weekly", goal, ...gainsOf(reward) })),
    ...steps.map(({ step, reward }): QuestDone => ({ kind: "journey", step, ...gainsOf(reward) })),
  ];
}

function gainsOf({ xp, coins }: Reward) {
  return { xp, ...(coins > 0 && { coins }) };
}
