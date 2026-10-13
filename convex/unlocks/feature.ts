import { v, type Infer } from "convex/values";

export const featureValidator = v.union(
  v.literal("quests"),
  v.literal("leaderboard"),
  v.literal("book"),
  v.literal("skillTree"),
  v.literal("coins"),
  v.literal("hedgehogs"),
);

export type Feature = Infer<typeof featureValidator>;
