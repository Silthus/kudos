import type { QueryCtx } from "../_generated/server";
import { weekOf, type DayKey, type Week } from "../engine/allowance";
import { awardsInWeekNewestFirst, type WeekAward } from "../engine/awards";
import type { MessageRef } from "../engine/messageEvent";
import type { MemberId } from "../workspace/directory";

export const kudosListedAWeek = 50;
export const awardsReadAWeek = 500;
export const peopleNamedAKudos = 3;

type Side = "given" | "received";

export type WeekKudos = { message: MessageRef; at: number; people: MemberId[]; morePeople: number };

export type WeekKudosList = { kudos: WeekKudos[]; more: boolean };

export type WeekKudosLists = { given: WeekKudosList; received: WeekKudosList };

type MessageAwards = { message: MessageRef; at: number; people: MemberId[] };

export async function weekKudosOf(ctx: QueryCtx, member: MemberId, week: DayKey, lead: MessageRef | null): Promise<WeekKudosLists> {
  const days = weekOf(week);
  return { given: await kudosListOf(ctx, member, "given", days, lead), received: await kudosListOf(ctx, member, "received", days, lead) };
}

async function kudosListOf(ctx: QueryCtx, member: MemberId, side: Side, days: Week, lead: MessageRef | null): Promise<WeekKudosList> {
  const read = await awardsInWeekNewestFirst(ctx, member, side, days, awardsReadAWeek + 1);
  const cutShort = read.length > awardsReadAWeek;
  const messages = messagesOf(read, side);
  const whole = cutShort ? messages.slice(0, -1) : messages;
  const listed = whole.filter(({ message }) => lead === null || !isSameMessage(message, lead));
  return { kudos: listed.slice(0, kudosListedAWeek).map(withAFewNamed), more: cutShort || listed.length > kudosListedAWeek };
}

function messagesOf(awards: WeekAward[], side: Side): MessageAwards[] {
  const messages = new Map<string, MessageAwards>();
  for (const { message, giver, recipient, at } of awards) {
    const key = `${message.workspace}/${message.conversation}/${message.message}`;
    const known = messages.get(key) ?? { message, at, people: [] };
    known.people.unshift(side === "given" ? recipient : giver);
    messages.set(key, known);
  }
  return [...messages.values()];
}

function withAFewNamed({ message, at, people }: MessageAwards): WeekKudos {
  return { message, at, people: people.slice(0, peopleNamedAKudos), morePeople: Math.max(0, people.length - peopleNamedAKudos) };
}

function isSameMessage(one: MessageRef, other: MessageRef) {
  return one.workspace === other.workspace && one.conversation === other.conversation && one.message === other.message;
}
