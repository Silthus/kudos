import { v, type Infer } from "convex/values";
import type { Feature } from "../unlocks/feature";

export const journeyStepValidator = v.union(v.literal("first-thanks"), v.literal("first-quest"), v.literal("someone-new"));

export type JourneyStep = Infer<typeof journeyStepValidator>;

const journeyStepsOpenedBy: Partial<Record<Feature, JourneyStep>> = { quests: "first-quest", leaderboard: "someone-new" };

export function journeyStepOpenedBy(feature: Feature): JourneyStep | null {
  return journeyStepsOpenedBy[feature] ?? null;
}

export const journeyQuestValidator = v.object({ kind: v.literal("journey"), step: journeyStepValidator });

export type JourneyQuest = Infer<typeof journeyQuestValidator>;

export const weeklyQuestValidator = v.object({ kind: v.literal("weekly"), week: v.string(), slot: v.number() });

export type WeeklyQuest = Infer<typeof weeklyQuestValidator>;

export const questValidator = v.union(journeyQuestValidator, weeklyQuestValidator);

export type Quest = Infer<typeof questValidator>;
