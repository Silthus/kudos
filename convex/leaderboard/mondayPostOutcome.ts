import { v, type Infer } from "convex/values";

export const mondayPostOutcomeValidator = v.union(v.literal("claimed"), v.literal("nobody-gave"), v.literal("posted"), v.literal("cant-post"), v.literal("failed"));

export type MondayPostOutcome = Infer<typeof mondayPostOutcomeValidator>;
