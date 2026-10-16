import { v, type Infer } from "convex/values";
import { rarityValidator } from "./catalogue";

export const dropValidator = v.object({
  member: v.id("members"),
  crate: v.string(),
  hoggie: v.string(),
  rarity: rarityValidator,
  n: v.number(),
  copy: v.number(),
  catalogueVersion: v.number(),
  at: v.number(),
  crest: v.optional(v.union(v.string(), v.null())),
});

export const hoggieTallyValidator = v.object({ member: v.id("members"), hoggie: v.string(), count: v.number(), firstAt: v.number(), firstN: v.number() });

export const dropTallyValidator = v.object({ member: v.id("members"), drops: v.number() });

export type DropRecord = Infer<typeof dropValidator>;
