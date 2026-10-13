import { v, type Infer } from "convex/values";

export const journeyStepValidator = v.literal("first-thanks");

export type JourneyStep = Infer<typeof journeyStepValidator>;
