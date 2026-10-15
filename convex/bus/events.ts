import { v, type Infer } from "convex/values";
import { ladderValidator, tierValidator } from "../achievements/ladders";
import { awardIdValidator } from "../engine/awards";
import { attributedAwardValidator, groupOrNoneValidator } from "../groups/attributedAward";
import { primaryGroupCauseValidator } from "../groups/cause";
import { annotationsValidator, messageRefValidator } from "../engine/messageEvent";
import { perkValidator } from "../progression/tree";
import { questIdValidator } from "../quests/pool";
import { journeyStepValidator, questValidator } from "../quests/step";
import { featureValidator } from "../unlocks/feature";
import { rarityValidator } from "../hoggies/catalogue";
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
  loadoutEmoji: v.optional(v.array(v.string())),
  annotations: annotationsValidator,
  allowance: v.object({ dailyOpening: v.number(), dailyLeft: v.number() }),
  skippedMentions: v.number(),
  retry: v.boolean(),
  inThread: v.boolean(),
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
  message: v.optional(messageRefValidator),
  at: v.number(),
});

export const xpRecordedEventValidator = v.object({
  type: v.literal("xpRecorded"),
  workspace: v.string(),
  member: v.id("members"),
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

export type LevelReachedEvent = Infer<typeof levelReachedEventValidator>;

export type XpRecordedEvent = Infer<typeof xpRecordedEventValidator>;

const unlockFields = { workspace: v.string(), member: v.id("members"), feature: featureValidator, at: v.number() };

export const unlockReadyEventValidator = v.object({ type: v.literal("unlockReady"), ...unlockFields });

export const unlockOpenedEventValidator = v.object({ type: v.literal("unlockOpened"), ...unlockFields, byLaunch: v.optional(v.literal(true)) });

export type UnlockReadyEvent = Infer<typeof unlockReadyEventValidator>;

export type UnlockOpenedEvent = Infer<typeof unlockOpenedEventValidator>;

export const unlocksLaunchedEventValidator = v.object({
  type: v.literal("unlocksLaunched"),
  workspace: v.string(),
  openings: v.array(v.object({ member: v.id("members"), feature: featureValidator })),
  at: v.number(),
});

export type UnlocksLaunchedEvent = Infer<typeof unlocksLaunchedEventValidator>;

const questFields = { workspace: v.string(), member: v.id("members"), quest: questValidator, at: v.number() };

export const questFinishedEventValidator = v.object({
  type: v.literal("questFinished"),
  ...questFields,
  poolQuest: v.optional(questIdValidator),
  reward: v.optional(v.object({ xp: v.number(), coins: v.number() })),
});

export const questOpenedEventValidator = v.object({ type: v.literal("questOpened"), ...questFields, poolQuest: v.optional(questIdValidator) });

const weekFields = { workspace: v.string(), member: v.id("members"), week: v.string(), at: v.number() };

export const questsDrawnEventValidator = v.object({ type: v.literal("questsDrawn"), ...weekFields, quests: v.array(questIdValidator) });

export const questSwappedEventValidator = v.object({ type: v.literal("questSwapped"), ...weekFields, replaced: questIdValidator, swappedIn: questIdValidator });

export type QuestsDrawnEvent = Infer<typeof questsDrawnEventValidator>;

export type QuestSwappedEvent = Infer<typeof questSwappedEventValidator>;

export const achievementEarnedEventValidator = v.object({
  type: v.literal("achievementEarned"),
  workspace: v.string(),
  member: v.id("members"),
  ladder: ladderValidator,
  tier: tierValidator,
  at: v.number(),
  batch: v.optional(v.id("bookBatches")),
});

export type AchievementEarnedEvent = Infer<typeof achievementEarnedEventValidator>;

export const perkBoughtEventValidator = v.object({ type: v.literal("perkBought"), workspace: v.string(), member: v.id("members"), perk: perkValidator, at: v.number() });

export type PerkBoughtEvent = Infer<typeof perkBoughtEventValidator>;

export const itemBoughtEventValidator = v.object({ type: v.literal("itemBought"), workspace: v.string(), member: v.id("members"), item: v.string(), price: v.number(), at: v.number() });

export type ItemBoughtEvent = Infer<typeof itemBoughtEventValidator>;

const membershipFields = { workspace: v.string(), member: v.id("members"), at: v.number() };

export const memberLeftEventValidator = v.object({ type: v.literal("memberLeft"), ...membershipFields });

export const memberRejoinedEventValidator = v.object({ type: v.literal("memberRejoined"), ...membershipFields });

export type MemberLeftEvent = Infer<typeof memberLeftEventValidator>;

export type MemberRejoinedEvent = Infer<typeof memberRejoinedEventValidator>;

export type QuestFinishedEvent = Infer<typeof questFinishedEventValidator>;

export type QuestOpenedEvent = Infer<typeof questOpenedEventValidator>;

export const primaryGroupChangedEventValidator = v.object({
  type: v.literal("primaryGroupChanged"),
  workspace: v.string(),
  member: v.id("members"),
  from: v.union(v.id("userGroups"), v.null()),
  to: v.union(v.id("userGroups"), v.null()),
  cause: primaryGroupCauseValidator,
  at: v.number(),
});

export type PrimaryGroupChangedEvent = Infer<typeof primaryGroupChangedEventValidator>;

const attributedFields = {
  workspace: v.string(),
  message: messageRefValidator,
  giver: v.id("members"),
  group: groupOrNoneValidator,
  kudos: v.number(),
  day: v.string(),
  at: v.number(),
  awards: v.array(attributedAwardValidator),
};

export const awardsAttributedEventValidator = v.object({ type: v.literal("awardsAttributed"), ...attributedFields });

export type AwardsAttributedEvent = Infer<typeof awardsAttributedEventValidator>;

export const journeyStepActivatedEventValidator = v.object({
  type: v.literal("journeyStepActivated"),
  workspace: v.string(),
  member: v.id("members"),
  step: journeyStepValidator,
  at: v.number(),
});

export type JourneyStepActivatedEvent = Infer<typeof journeyStepActivatedEventValidator>;

export const hoggieDroppedEventValidator = v.object({
  type: v.literal("hoggieDropped"),
  workspace: v.string(),
  member: v.id("members"),
  crate: v.string(),
  hoggie: v.string(),
  rarity: rarityValidator,
  copy: v.number(),
  at: v.number(),
});

export type HoggieDroppedEvent = Infer<typeof hoggieDroppedEventValidator>;

export type DomainEvent =
  | KudosGivenEvent
  | AttemptFailedEvent
  | MemberWelcomedEvent
  | LevelReachedEvent
  | XpRecordedEvent
  | UnlockReadyEvent
  | UnlockOpenedEvent
  | UnlocksLaunchedEvent
  | QuestFinishedEvent
  | QuestOpenedEvent
  | QuestsDrawnEvent
  | QuestSwappedEvent
  | JourneyStepActivatedEvent
  | AchievementEarnedEvent
  | PerkBoughtEvent
  | ItemBoughtEvent
  | MemberLeftEvent
  | MemberRejoinedEvent
  | PrimaryGroupChangedEvent
  | AwardsAttributedEvent
  | HoggieDroppedEvent;

export function membersNamedIn(event: KudosGivenEvent): MemberId[] {
  return [...new Set([event.giver, ...event.awards.map((award) => award.recipient)])];
}
