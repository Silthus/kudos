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

export const attemptFailedEventValidator = v.object({
  type: v.literal("attemptFailed"),
  workspace: v.string(),
  message: messageRefValidator,
  giver: v.id("members"),
  outcome: v.union(v.literal("over-allowance"), v.literal("invalid")),
  recipients: v.number(),
  perRecipient: v.number(),
  cost: v.number(),
  skippedMentions: v.number(),
  retry: v.boolean(),
  inThread: v.boolean(),
  allowance: v.object({ dailyLeft: v.number() }),
  day: v.string(),
  at: v.number(),
});

export type AttemptFailedEvent = Infer<typeof attemptFailedEventValidator>;

export const memberWelcomedEventValidator = v.object({
  type: v.literal("memberWelcomed"),
  workspace: v.string(),
  member: v.id("members"),
  as: v.union(v.literal("giver"), v.literal("recipient")),
  at: v.number(),
});

export type MemberWelcomedEvent = Infer<typeof memberWelcomedEventValidator>;

export type DomainEvent = KudosGivenEvent | AttemptFailedEvent | MemberWelcomedEvent;
