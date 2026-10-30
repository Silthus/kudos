import { v, type Infer } from "convex/values";

export const welcomedAsValidator = v.union(
  v.object({ as: v.literal("recipient"), giver: v.string() }),
  v.object({ as: v.literal("giver"), recipients: v.array(v.string()) }),
);

export type WelcomedAs = Infer<typeof welcomedAsValidator>;

const pathOfTheRetiredCatchUp = v.literal("catch-up");

export const welcomePathValidator = v.union(v.literal("hug"), v.literal("thoughtful-given"), v.literal("thoughtful-received"), pathOfTheRetiredCatchUp);

export type WelcomePath = Infer<typeof welcomePathValidator>;
