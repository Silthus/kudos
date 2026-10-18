import { v, type Infer } from "convex/values";

export const surfaceValidator = v.union(v.literal("slack"), v.literal("website"));

export type Surface = Infer<typeof surfaceValidator>;
