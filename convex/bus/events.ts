import { v, type Infer } from "convex/values";
import { annotationsValidator, messageRefValidator } from "../engine/messageEvent";

export const awardValidator = v.object({ giver: v.id("members"), recipient: v.id("members"), kudos: v.number() });

export const kudosGivenEventValidator = v.object({
  type: v.literal("kudosGiven"),
  workspace: v.string(),
  message: messageRefValidator,
  giver: v.id("members"),
  awards: v.array(awardValidator),
  kudosEmoji: v.string(),
  annotations: annotationsValidator,
  allowance: v.object({ dailyOpening: v.number(), dailyLeft: v.number() }),
  skippedMentions: v.number(),
  retry: v.boolean(),
  inThread: v.boolean(),
  day: v.string(),
  at: v.number(),
});

export type KudosGivenEvent = Infer<typeof kudosGivenEventValidator>;

export type DomainEvent = KudosGivenEvent;
