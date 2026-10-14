import { v, type Infer } from "convex/values";
import type {
  AttemptFailedEvent,
  JourneyStepActivatedEvent,
  KudosGivenEvent,
  LevelReachedEvent,
  MemberWelcomedEvent,
  QuestFinishedEvent,
  QuestsDrawnEvent,
  QuestSwappedEvent,
  UnlockOpenedEvent,
  UnlockReadyEvent,
  UnlocksLaunchedEvent,
} from "../bus/events";
import type { Award } from "../engine/awards";
import type { KudosCommandResult } from "../feedback/kudosCommand";
import type { Feature } from "../unlocks/feature";
import { gateDecisionOf } from "../progression/gate";
import { defaultKudosEmoji } from "../workspace/settings";
import type { MemberId } from "../workspace/directory";

export const propertiesValidator = v.record(v.string(), v.union(v.string(), v.number(), v.boolean()));

export type Properties = Infer<typeof propertiesValidator>;

export type ProductEvent = {
  event:
    | "kudos given"
    | "kudos received"
    | "attempt failed"
    | "member welcomed"
    | "level reached"
    | "unlock made ready"
    | "unlock opened"
    | "quest drawn"
    | "quest swapped"
    | "quest finished"
    | "journey step activated"
    | "app home opened"
    | "command used"
    | "$feature_flag_called";
  subject: { member: MemberId };
  at: number;
  properties: Properties;
};

export type UsageFact =
  | { kind: "appHomeOpened"; workspace: string; member: MemberId; at: number }
  | { kind: "commandUsed"; workspace: string; member: MemberId; alias: boolean; result: KudosCommandResult; at: number };

const outcomeNames: Record<AttemptFailedEvent["outcome"], string> = { "over-allowance": "over allowance", invalid: "invalid" };

const featureNames: Record<Feature, string> = {
  quests: "quests",
  leaderboard: "leaderboard",
  book: "book",
  skillTree: "skill tree",
  coins: "coins",
  hedgehogs: "hedgehogs",
};

const commandResultNames: Record<KudosCommandResult, string> = {
  joined: "joined",
  "already-in": "already in",
  "private-channel": "private channel",
  "direct-message": "direct message",
};

export function projectKudosGiven(event: KudosGivenEvent): ProductEvent[] {
  return [kudosGiven(event), ...event.awards.map((award) => kudosReceived(event, award))];
}

function kudosGiven(event: KudosGivenEvent): ProductEvent {
  const kudosPerRecipient = event.awards[0]?.kudos ?? 0;
  return {
    event: "kudos given",
    subject: { member: event.giver },
    at: event.at,
    properties: {
      recipients: event.awards.length,
      kudos_per_recipient: kudosPerRecipient,
      kudos_total: event.awards.length * kudosPerRecipient,
      skipped_mentions: event.skippedMentions,
      retry: event.retry,
      in_thread: event.inThread,
      daily_allowance_opening: event.allowance.dailyOpening,
      daily_allowance_left: event.allowance.dailyLeft,
      default_kudos_emoji: event.kudosEmoji === defaultKudosEmoji(),
      thoughtful: gateDecisionOf(event.annotations)?.thoughtful === true,
    },
  };
}

function kudosReceived(event: KudosGivenEvent, award: Award): ProductEvent {
  return {
    event: "kudos received",
    subject: { member: award.recipient },
    at: event.at,
    properties: { kudos: award.kudos, retry: event.retry },
  };
}

export function projectAttemptFailed(event: AttemptFailedEvent): ProductEvent {
  return {
    event: "attempt failed",
    subject: { member: event.giver },
    at: event.at,
    properties: {
      outcome: outcomeNames[event.outcome],
      recipients: event.recipients,
      kudos_per_recipient: event.perRecipient,
      kudos_total: event.cost,
      skipped_mentions: event.skippedMentions,
      retry: event.retry,
      in_thread: event.inThread,
      daily_allowance_left: event.allowance.dailyLeft,
    },
  };
}

export function projectMemberWelcomed(event: MemberWelcomedEvent): ProductEvent {
  return { event: "member welcomed", subject: { member: event.member }, at: event.at, properties: { as: event.as } };
}

export function projectLevelReached(event: LevelReachedEvent): ProductEvent {
  return {
    event: "level reached",
    subject: { member: event.member },
    at: event.at,
    properties: { level: event.level, skill_points_gained: event.skillPointsGained, via: event.message === undefined ? "reward" : "kudos" },
  };
}

export function projectUnlockReady(event: UnlockReadyEvent): ProductEvent {
  return { event: "unlock made ready", subject: { member: event.member }, at: event.at, properties: { feature: featureNames[event.feature] } };
}

export function projectUnlockOpened(event: UnlockOpenedEvent): ProductEvent {
  return {
    event: "unlock opened",
    subject: { member: event.member },
    at: event.at,
    properties: { feature: featureNames[event.feature], by: event.byLaunch === true ? "launch" : "member" },
  };
}

export function projectUnlocksLaunched({ workspace, openings, at }: UnlocksLaunchedEvent): ProductEvent[] {
  return openings.map(({ member, feature }) => projectUnlockOpened({ type: "unlockOpened", workspace, member, feature, at, byLaunch: true }));
}

export function projectQuestsDrawn(event: QuestsDrawnEvent): ProductEvent[] {
  return event.quests.map((quest) => ({ event: "quest drawn", subject: { member: event.member }, at: event.at, properties: { quest } }));
}

export function projectQuestSwapped(event: QuestSwappedEvent): ProductEvent {
  return { event: "quest swapped", subject: { member: event.member }, at: event.at, properties: { replaced: event.replaced, quest: event.swappedIn } };
}

export function projectQuestFinished(event: QuestFinishedEvent): ProductEvent {
  const quest = event.quest.kind === "journey" ? event.quest.step : event.poolQuest;
  return {
    event: "quest finished",
    subject: { member: event.member },
    at: event.at,
    properties: { kind: event.quest.kind, ...(quest === undefined ? {} : { quest }), ...(event.reward === undefined ? {} : { xp: event.reward.xp, coins: event.reward.coins }) },
  };
}

export function projectJourneyStepActivated(event: JourneyStepActivatedEvent): ProductEvent {
  return { event: "journey step activated", subject: { member: event.member }, at: event.at, properties: { step: event.step } };
}

export function projectUsage(fact: UsageFact): ProductEvent {
  const subject = { member: fact.member };
  if (fact.kind === "appHomeOpened") return { event: "app home opened", subject, at: fact.at, properties: {} };
  return {
    event: "command used",
    subject,
    at: fact.at,
    properties: { command: "hedgehug", alias: fact.alias, result: commandResultNames[fact.result] },
  };
}
