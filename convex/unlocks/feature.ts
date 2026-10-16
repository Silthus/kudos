import { v, type Infer } from "convex/values";

export const featureValidator = v.union(
  v.literal("quests"),
  v.literal("leaderboard"),
  v.literal("book"),
  v.literal("skillTree"),
  v.literal("coins"),
);

export type Feature = Infer<typeof featureValidator>;

export function featureCrateKeyOf(feature: Feature): `unlock:${Feature}` {
  return `unlock:${feature}`;
}

export function featureOfCrateKey(crate: string): Feature | null {
  return featureValidator.members.map(({ value }) => value).find((feature) => featureCrateKeyOf(feature) === crate) ?? null;
}
