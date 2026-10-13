import { v, type Infer } from "convex/values";
import type { AttemptFailedEvent, KudosGivenEvent, MemberWelcomedEvent } from "../bus/events";
import type { Award } from "../engine/awards";
import type { KudosCommandResult } from "../feedback/kudosCommand";
import { defaultKudosEmoji } from "../workspace/settings";
import type { MemberId } from "../workspace/directory";

export const propertiesValidator = v.record(v.string(), v.union(v.string(), v.number(), v.boolean()));

export type Properties = Infer<typeof propertiesValidator>;

export type ProductEvent = {
  event: "kudos given" | "kudos received" | "attempt failed" | "member welcomed" | "app home opened" | "command used" | "$feature_flag_called";
  subject: { member: MemberId };
  at: number;
  properties: Properties;
};

export type UsageFact =
  | { kind: "appHomeOpened"; workspace: string; member: MemberId; at: number }
  | { kind: "commandUsed"; workspace: string; member: MemberId; alias: boolean; result: KudosCommandResult; at: number };

const outcomeNames: Record<AttemptFailedEvent["outcome"], string> = { "over-allowance": "over allowance", invalid: "invalid" };

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
