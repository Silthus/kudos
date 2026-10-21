import { v, type Infer } from "convex/values";
import { messageRefValidator } from "../engine/messageEvent";

export const itemSourceValidator = v.literal("hoggie");

export const itemReasonValidator = v.object({ kind: v.literal("thanks"), person: v.id("members"), message: messageRefValidator });

export const itemValidator = v.object({
  workspace: v.string(),
  member: v.id("members"),
  source: itemSourceValidator,
  key: v.string(),
  reason: itemReasonValidator,
  earnedAt: v.number(),
  turnedAt: v.optional(v.number()),
});

export type ItemSource = Infer<typeof itemSourceValidator>;

export type ItemReason = Infer<typeof itemReasonValidator>;

export type Earning = Omit<Infer<typeof itemValidator>, "turnedAt">;
