import { v, type Infer } from "convex/values";

export const journeyStepValidator = v.literal("first-thanks");

export type JourneyStep = Infer<typeof journeyStepValidator>;

export const questValidator = v.object({ kind: v.literal("journey"), step: journeyStepValidator });

export type Quest = Infer<typeof questValidator>;
