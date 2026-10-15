import { v, type Infer } from "convex/values";

export const primaryGroupCauseValidator = v.union(v.literal("default"), v.literal("picked"), v.literal("fallback"));

export type PrimaryGroupCause = Infer<typeof primaryGroupCauseValidator>;
