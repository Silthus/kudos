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

export const hoggieAvatarValidator = v.object({ member: v.id("members"), hoggie: v.string() });

export const boughtCrateValidator = v.object({ member: v.id("members"), crate: v.string(), n: v.number(), boughtAt: v.number(), openedAt: v.optional(v.number()) });

const crateRefusalReasonValidator = v.union(v.literal("stale"), v.literal("coins-not-open"), v.literal("no-coins"));

export const crateRefusalValidator = v.object({ kind: v.literal("refused"), crate: v.string(), reason: crateRefusalReasonValidator });

export type DropRecord = Infer<typeof dropValidator>;

export type CrateRefusal = Infer<typeof crateRefusalValidator>;

export type CratePurchaseOutcome = { kind: "bought"; crate: string } | CrateRefusal;
