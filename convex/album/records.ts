import { v, type Infer } from "convex/values";
import { awardIdValidator } from "../engine/awards";
import { messageRefValidator } from "../engine/messageEvent";

export const grantOutcomeValidator = v.union(v.literal("new"), v.literal("held"), v.literal("waiting"), v.literal("nextWeek"));

export type GrantOutcome = Infer<typeof grantOutcomeValidator>;

export const thoughtfulPackValidator = v.object({
  workspace: v.string(),
  giver: v.id("members"),
  recipient: v.id("members"),
  week: v.string(),
  message: messageRefValidator,
  holdsSticker: v.boolean(),
  at: v.number(),
});

export const grantRecordValidator = v.object({
  giver: v.id("members"),
  message: messageRefValidator,
  recipient: v.id("members"),
  outcome: grantOutcomeValidator,
});

export const grantToldValidator = v.object({ message: messageRefValidator });

export const albumStickerValidator = v.object({
  member: v.id("members"),
  person: v.id("members"),
  from: v.union(v.literal("pack"), v.literal("history")),
  pack: v.optional(v.id("thoughtfulPacks")),
  at: v.number(),
});

export const emojiNameValidator = v.object({ workspace: v.string(), emoji: v.string(), person: v.optional(v.id("members")), name: v.string() });

export const emojiNameNumberValidator = v.object({ workspace: v.string(), stem: v.string(), last: v.number() });

export const albumHistoryValidator = v.object({
  workspace: v.string(),
  startedAt: v.number(),
  phase: v.union(v.literal("kudos"), v.literal("hugs")),
  cursor: v.union(v.string(), v.null()),
  hug: v.optional(v.id("hugs")),
  hugPeopleAfter: v.optional(v.id("members")),
  done: v.boolean(),
});

const kudosPickValidator = v.object({ message: messageRefValidator, words: v.number(), at: v.number() });

export type KudosPick = Infer<typeof kudosPickValidator>;

export const pairTallyValidator = v.object({
  member: v.id("members"),
  person: v.id("members"),
  firstThankedAt: v.union(v.number(), v.null()),
  kudosGiven: v.number(),
  kudosReceived: v.number(),
  hugsGiven: v.number(),
  hugsReceived: v.number(),
  best: v.union(kudosPickValidator, v.null()),
});

const peopleListValidator = v.object({ people: v.array(v.id("members")), more: v.number() });

export const weekListValidator = v.union(v.literal("thanked"), v.literal("thankedBy"), v.literal("hugged"), v.literal("huggedBy"));

export type WeekList = Infer<typeof weekListValidator>;

const hugPickValidator = v.object({ message: messageRefValidator, hugs: v.number(), words: v.number(), at: v.number() });

export type HugPick = Infer<typeof hugPickValidator>;

export const weekTallyValidator = v.object({
  member: v.id("members"),
  week: v.string(),
  kudosGiven: v.number(),
  kudosReceived: v.number(),
  thoughtfulGiven: v.number(),
  thoughtfulReceived: v.number(),
  hugsGiven: v.number(),
  hugsReceived: v.number(),
  thanked: peopleListValidator,
  thankedBy: peopleListValidator,
  hugged: peopleListValidator,
  huggedBy: peopleListValidator,
  kudosOfWeek: v.union(hugPickValidator, v.null()),
  days: v.array(v.number()),
});

export const weekPersonValidator = v.object({ member: v.id("members"), week: v.string(), list: weekListValidator, person: v.id("members") });

export const talliedAwardValidator = v.object({ award: awardIdValidator });

export const talliedHugValidator = v.object({ hug: v.id("hugs"), person: v.id("members") });
