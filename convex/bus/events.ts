import { v, type Infer } from "convex/values";
import { awardIdValidator } from "../engine/awards";
import { annotationsValidator, messageRefValidator } from "../engine/messageEvent";
import type { MemberId } from "../workspace/directory";

export const awardValidator = v.object({ award: awardIdValidator, giver: v.id("members"), recipient: v.id("members"), kudos: v.number() });

export const kudosGivenEventValidator = v.object({
  type: v.literal("kudosGiven"),
  workspace: v.string(),
  message: messageRefValidator,
  giver: v.id("members"),
  awards: v.array(awardValidator),
  via: v.union(v.literal("message"), v.literal("chime-in")),
  kudosEmoji: v.string(),
  annotations: annotationsValidator,
  allowance: v.object({ dailyOpening: v.number(), dailyLeft: v.number() }),
  day: v.string(),
  at: v.number(),
});

export const levelReachedEventValidator = v.object({
  type: v.literal("levelReached"),
  workspace: v.string(),
  member: v.id("members"),
  level: v.number(),
  skillPointsGained: v.number(),
  skillPoints: v.number(),
  xpToNextLevel: v.number(),
  message: messageRefValidator,
  at: v.number(),
});

export type KudosGivenEvent = Infer<typeof kudosGivenEventValidator>;
export type LevelReachedEvent = Infer<typeof levelReachedEventValidator>;

export type DomainEvent = KudosGivenEvent | LevelReachedEvent;

export function membersNamedIn(event: KudosGivenEvent): MemberId[] {
  return [...new Set([event.giver, ...event.awards.map((award) => award.recipient)])];
}
