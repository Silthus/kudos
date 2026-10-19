import { v, type Infer } from "convex/values";
import { awardIdValidator } from "../engine/awards";
import { messageRefValidator } from "../engine/messageEvent";
import { rarityValidator } from "../hoggies/catalogue";

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
  openedAt: v.optional(v.number()),
});

export const grantRecordValidator = v.object({
  giver: v.id("members"),
  message: messageRefValidator,
  recipient: v.id("members"),
  outcome: grantOutcomeValidator,
});

export const thoughtfulTallyValidator = v.object({ workspace: v.string(), week: v.string(), giver: v.id("members"), awards: v.number() });

export const grantToldValidator = v.object({ message: messageRefValidator });

export const albumStickerValidator = v.object({
  member: v.id("members"),
  person: v.id("members"),
  from: v.union(v.literal("pack"), v.literal("history")),
  pack: v.optional(v.id("thoughtfulPacks")),
  at: v.number(),
});

const trayItemFields = { member: v.id("members"), pack: v.id("thoughtfulPacks"), at: v.number(), putInAt: v.optional(v.number()) };

export const trayItemValidator = v.union(
  v.object({ ...trayItemFields, kind: v.literal("sticker"), person: v.id("members") }),
  v.object({ ...trayItemFields, kind: v.literal("hoggie"), hoggie: v.string(), rarity: rarityValidator, isNew: v.boolean() }),
);

export const teamArtValidator = v.union(v.object({ kind: v.literal("crest"), slug: v.string() }), v.object({ kind: v.literal("image"), url: v.string() }), v.null());

export const teamStickerValidator = v.object({ member: v.id("members"), team: v.string(), at: v.number(), name: v.string(), art: teamArtValidator, emoji: v.string() });

export type TeamSticker = Omit<Infer<typeof teamStickerValidator>, "member">;

export const milestoneTierValidator = v.union(v.literal("bronze"), v.literal("silver"), v.literal("gold"), v.literal("diamond"));

export type MilestoneTier = Infer<typeof milestoneTierValidator>;

export const milestoneIdValidator = v.union(v.literal("people"), v.literal("teams"), v.literal("reach"), v.literal("hoggies"), v.literal("thoughtful"));

export type MilestoneId = Infer<typeof milestoneIdValidator>;

export const milestoneTierRecordValidator = v.object({ member: v.id("members"), milestone: milestoneIdValidator, tier: milestoneTierValidator, at: v.number(), catalogue: v.number() });

export const emojiNameValidator = v.object({ workspace: v.string(), emoji: v.string(), person: v.optional(v.id("members")), name: v.string() });

export const seenEmojiValidator = v.object({ member: v.id("members"), emoji: v.string(), at: v.number() });

export const emojiNameNumberValidator = v.object({ workspace: v.string(), stem: v.string(), last: v.number() });

export const emojiClassValidator = v.object({ workspace: v.string(), name: v.string(), class: v.union(v.literal("random"), v.literal("unmapped")) });

export const randomEmojiDropValidator = v.object({ member: v.id("members"), name: v.string(), pack: v.id("thoughtfulPacks"), at: v.number() });

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

const hoggieFoundValidator = v.object({ hoggie: v.string(), rarity: rarityValidator });

export type HoggieFound = Infer<typeof hoggieFoundValidator>;

const hoggiesListValidator = v.object({ hoggies: v.array(hoggieFoundValidator), more: v.number() });

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
  packsOpened: v.optional(v.number()),
  newFaces: v.optional(peopleListValidator),
  hoggiesFound: v.optional(hoggiesListValidator),
});

export const weekPersonValidator = v.object({ member: v.id("members"), week: v.string(), list: weekListValidator, person: v.id("members") });

export const talliedAwardValidator = v.object({ award: awardIdValidator });

export const talliedHugValidator = v.object({ hug: v.id("hugs"), person: v.id("members") });
