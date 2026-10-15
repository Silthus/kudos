import { v, type Infer } from "convex/values";

export const groupModeValidator = v.union(v.literal("all"), v.literal("allowlist"));

export type GroupModeKind = Infer<typeof groupModeValidator>;
