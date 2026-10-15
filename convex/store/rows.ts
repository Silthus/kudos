import { v, type Infer } from "convex/values";

export const slotValidator = v.union(v.literal("emoji-1"), v.literal("emoji-2"), v.literal("emoji-3"));

export const collectedItemValidator = v.object({
  member: v.id("members"),
  item: v.string(),
  source: v.union(v.literal("store"), v.literal("tier")),
  arrivedAt: v.number(),
});

export const loadoutSlotValidator = v.object({ member: v.id("members"), slot: slotValidator, item: v.union(v.string(), v.null()) });

const refusalReasonValidator = v.union(v.literal("coins-not-open"), v.literal("not-for-sale"), v.literal("owned"), v.literal("no-coins"));

export const itemRefusalValidator = v.object({ kind: v.literal("refused"), item: v.string(), reason: refusalReasonValidator });

export const itemPurchaseOutcomeValidator = v.union(v.object({ kind: v.literal("bought"), item: v.string() }), itemRefusalValidator);

export const itemPurchaseValidator = v.object({ member: v.id("members"), key: v.string(), outcome: itemPurchaseOutcomeValidator });

export type Slot = Infer<typeof slotValidator>;

export const slots: readonly Slot[] = ["emoji-1", "emoji-2", "emoji-3"];

export type ItemPurchaseOutcome = Infer<typeof itemPurchaseOutcomeValidator>;

export type ItemRefusal = Infer<typeof itemRefusalValidator>;

export type CollectedItem = Infer<typeof collectedItemValidator>;
