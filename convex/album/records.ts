import { v, type Infer } from "convex/values";
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

export const emojiNameValidator = v.object({ workspace: v.string(), emoji: v.string(), person: v.optional(v.id("members")), name: v.string() });

export const emojiNameNumberValidator = v.object({ workspace: v.string(), stem: v.string(), last: v.number() });
