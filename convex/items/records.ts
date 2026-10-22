import { v, type Infer } from "convex/values";
import { milestoneIdValidator, milestoneTierValidator } from "../album/records";
import { messageRefValidator } from "../engine/messageEvent";
import { rarityValidator } from "../hoggies/catalogue";

export const itemSourceValidator = v.union(v.literal("sticker"), v.literal("hoggie"));

export const itemReasonValidator = v.union(
  v.object({ kind: v.literal("thanks"), person: v.id("members"), message: messageRefValidator }),
  v.object({ kind: v.literal("levelUp"), level: v.number() }),
  v.object({ kind: v.literal("welcome") }),
  v.object({ kind: v.literal("team"), team: v.string(), name: v.string() }),
  v.object({ kind: v.literal("milestone"), milestone: milestoneIdValidator, tier: milestoneTierValidator }),
  v.object({ kind: v.literal("forge"), hoggie: v.string() }),
);

export const itemValidator = v.object({
  workspace: v.string(),
  member: v.id("members"),
  source: itemSourceValidator,
  key: v.string(),
  floor: v.optional(rarityValidator),
  reason: itemReasonValidator,
  earnedAt: v.number(),
  turnedAt: v.optional(v.number()),
});

export type ItemSource = Infer<typeof itemSourceValidator>;

export type ItemReason = Infer<typeof itemReasonValidator>;

export type Earning = Omit<Infer<typeof itemValidator>, "turnedAt">;
