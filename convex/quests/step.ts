import { v, type Infer } from "convex/values";

export const journeyStepValidator = v.literal("first-thanks");

export type JourneyStep = Infer<typeof journeyStepValidator>;

export const journeyQuestValidator = v.object({ kind: v.literal("journey"), step: journeyStepValidator });

export type JourneyQuest = Infer<typeof journeyQuestValidator>;

export const weeklyQuestValidator = v.object({ kind: v.literal("weekly"), week: v.string(), slot: v.number() });

export type WeeklyQuest = Infer<typeof weeklyQuestValidator>;

export const questValidator = v.union(journeyQuestValidator, weeklyQuestValidator);

export type Quest = Infer<typeof questValidator>;
