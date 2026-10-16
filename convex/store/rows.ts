import { v, type Infer } from "convex/values";

export const collectedItemValidator = v.object({
  member: v.id("members"),
  item: v.string(),
  source: v.union(v.literal("store"), v.literal("tier")),
  arrivedAt: v.number(),
});

const refusalReasonValidator = v.union(v.literal("coins-not-open"), v.literal("not-for-sale"), v.literal("owned"), v.literal("no-coins"));

export const itemRefusalValidator = v.object({ kind: v.literal("refused"), item: v.string(), reason: refusalReasonValidator });

export const itemPurchaseOutcomeValidator = v.union(v.object({ kind: v.literal("bought"), item: v.string() }), itemRefusalValidator);

export const itemPurchaseValidator = v.object({ member: v.id("members"), key: v.string(), outcome: itemPurchaseOutcomeValidator });

export const customKudosEmojiValidator = v.object({ workspace: v.string(), name: v.string(), url: v.string(), pickedAt: v.number(), unpickedAt: v.optional(v.number()) });

export type ItemPurchaseOutcome = Infer<typeof itemPurchaseOutcomeValidator>;

export type ItemRefusal = Infer<typeof itemRefusalValidator>;

export type CollectedItem = Infer<typeof collectedItemValidator>;
