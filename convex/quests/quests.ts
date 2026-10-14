import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { kudosGivenEventValidator, type KudosGivenEvent } from "../bus/events";
import { releaseSuccessReply, type QuestDone } from "../feedback/replies";
import { chatUserOf } from "../workspace/directory";
import { questsApplyIn } from "./flag";
import { advanceJourney, finishFirstQuestOnWeeklyFinished, journey, journeyOf, type JourneyStepFacts } from "./journey";
import { advanceWeeklyQuests, weeklyQuestsOf, type WeeklyQuests } from "./weekly";

export type QuestFacts = { journey: JourneyStepFacts[]; week: WeeklyQuests | null };

export const questsOf = internalQuery({
  args: { member: v.id("members") },
  handler: async (ctx, { member }): Promise<QuestFacts | null> => {
    const { workspace } = await chatUserOf(ctx, member);
    if (!(await questsApplyIn(ctx, workspace))) return null;
    return { journey: await journeyOf(ctx, member), week: await weeklyQuestsOf(ctx, member, Date.now()) };
  },
});

export const followKudosGiven = internalMutation({
  args: { event: kudosGivenEventValidator },
  handler: async (ctx, { event }) => {
    const questsDone = (await questsApplyIn(ctx, event.workspace)) ? await questsFinishedBy(ctx, event) : [];
    await releaseSuccessReply(ctx, event.message, questsDone);
  },
});

async function questsFinishedBy(ctx: MutationCtx, event: KudosGivenEvent): Promise<QuestDone[]> {
  const weeklyGoals = await advanceWeeklyQuests(ctx, event);
  const steps = await advanceJourney(ctx, event, journey);
  if (weeklyGoals.length > 0 && (await finishFirstQuestOnWeeklyFinished(ctx, event.workspace, event.giver, event.at))) steps.push("first-quest");
  return [...weeklyGoals.map((goal): QuestDone => ({ kind: "weekly", goal })), ...steps.map((step): QuestDone => ({ kind: "journey", step }))];
}
