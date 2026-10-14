import { v, type Infer } from "convex/values";

export const slotValidator = v.union(v.literal("emoji-1"), v.literal("emoji-2"), v.literal("emoji-3"));

export const collectedItemValidator = v.object({
  member: v.id("members"),
  item: v.string(),
  source: v.union(v.literal("store"), v.literal("tier")),
  arrivedAt: v.number(),
});

export const loadoutSlotValidator = v.object({ member: v.id("members"), slot: slotValidator, item: v.union(v.string(), v.null()) });

export type Slot = Infer<typeof slotValidator>;

export type CollectedItem = Infer<typeof collectedItemValidator>;
