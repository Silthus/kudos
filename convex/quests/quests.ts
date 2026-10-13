import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { chatUserOf } from "../workspace/directory";
import { questsApplyIn } from "./flag";
import { journeyOf, type JourneyStepFacts } from "./journey";
import { weeklyQuestsOf, type WeeklyQuests } from "./weekly";

export type QuestFacts = { journey: JourneyStepFacts[]; week: WeeklyQuests | null };

export const questsOf = internalQuery({
  args: { member: v.id("members") },
  handler: async (ctx, { member }): Promise<QuestFacts | null> => {
    const { workspace } = await chatUserOf(ctx, member);
    if (!(await questsApplyIn(ctx, workspace))) return null;
    return { journey: await journeyOf(ctx, member), week: await weeklyQuestsOf(ctx, member, Date.now()) };
  },
});
