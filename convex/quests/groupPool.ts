import { v } from "convex/values";

export const groupQuestIdValidator = v.union(v.literal("together-say-why"), v.literal("together-reach-out"));


export const groupFeasibleBecauseValidator = v.object({ participants: v.number(), membersOutside: v.number() });
