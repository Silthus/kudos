import { v, type Infer } from "convex/values";
import type { Feature } from "../unlocks/feature";

export const journeyStepValidator = v.union(v.literal("first-thanks"), v.literal("first-quest"), v.literal("someone-new"), v.literal("two-days"));

export type JourneyStep = Infer<typeof journeyStepValidator>;

const featuresOpening: Record<JourneyStep, Feature | null> = { "first-thanks": null, "first-quest": "quests", "someone-new": "leaderboard", "two-days": "book" };

export function journeyStepOpenedBy(feature: Feature): JourneyStep | null {
  return journeyStepValidator.members.map(({ value }) => value).find((step) => featuresOpening[step] === feature) ?? null;
}

export function featureOpening(step: JourneyStep): Feature | null {
  return featuresOpening[step];
}

export const journeyQuestValidator = v.object({ kind: v.literal("journey"), step: journeyStepValidator });

export type JourneyQuest = Infer<typeof journeyQuestValidator>;

export const weeklyQuestValidator = v.object({ kind: v.literal("weekly"), week: v.string(), slot: v.number() });

export type WeeklyQuest = Infer<typeof weeklyQuestValidator>;

export const questValidator = v.union(journeyQuestValidator, weeklyQuestValidator);

export type Quest = Infer<typeof questValidator>;
