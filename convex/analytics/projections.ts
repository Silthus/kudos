import { v, type Infer } from "convex/values";
import type { KudosGivenEvent } from "../bus/events";
import type { Award } from "../engine/awards";
import { defaultKudosEmoji } from "../workspace/settings";
import type { MemberId } from "../workspace/directory";

export const propertiesValidator = v.record(v.string(), v.union(v.string(), v.number(), v.boolean()));

export type Properties = Infer<typeof propertiesValidator>;

export type ProductEvent = {
  event: "kudos given" | "kudos received";
  subject: { member: MemberId };
  at: number;
  properties: Properties;
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
      default_kudos_emoji: event.kudosEmoji === defaultKudosEmoji,
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
