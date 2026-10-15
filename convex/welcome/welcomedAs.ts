import { v, type Infer } from "convex/values";

export const welcomedAsValidator = v.union(
  v.object({ as: v.literal("recipient"), giver: v.string() }),
  v.object({ as: v.literal("giver"), recipients: v.array(v.string()) }),
);

export type WelcomedAs = Infer<typeof welcomedAsValidator>;
