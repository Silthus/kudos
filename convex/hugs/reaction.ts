import { v, type Infer } from "convex/values";

export const hugReactionValidator = v.object({
  workspace: v.string(),
  giver: v.string(),
  author: v.string(),
  conversation: v.string(),
  message: v.string(),
  emoji: v.string(),
  at: v.number(),
});

export type HugReaction = Infer<typeof hugReactionValidator>;
