import { v, type Infer } from "convex/values";

export const starReactionValidator = v.object({
  workspace: v.string(),
  giver: v.string(),
  author: v.string(),
  conversation: v.string(),
  message: v.string(),
  at: v.number(),
});

export type StarReaction = Infer<typeof starReactionValidator>;
