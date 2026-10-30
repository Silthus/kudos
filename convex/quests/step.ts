import { v, type Infer } from "convex/values";

export const journeyStepValidator = v.union(v.literal("first-thanks"), v.literal("first-quest"), v.literal("someone-new"), v.literal("two-days"), v.literal("your-emoji"));

export type JourneyStep = Infer<typeof journeyStepValidator>;

export const journeyQuestValidator = v.object({ kind: v.literal("journey"), step: journeyStepValidator });

export type JourneyQuest = Infer<typeof journeyQuestValidator>;

export const weeklyQuestValidator = v.object({ kind: v.literal("weekly"), week: v.string(), slot: v.number() });

export type WeeklyQuest = Infer<typeof weeklyQuestValidator>;

export const groupQuestValidator = v.object({ kind: v.literal("group"), group: v.id("userGroups"), week: v.string() });

export type GroupQuestCrate = Infer<typeof groupQuestValidator>;

export const questValidator = v.union(journeyQuestValidator, weeklyQuestValidator, groupQuestValidator);

export type Quest = Infer<typeof questValidator>;
