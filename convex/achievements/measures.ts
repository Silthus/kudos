import type { DayKey } from "../engine/allowance";
import type { MemberId } from "../workspace/directory";
import type { LadderId } from "./ladders";

export type MeasuredAward = { giver: MemberId; recipient: MemberId; kudos: number; day: DayKey };

export type Mark = { group: string; key: string; distinct: number };

export type Step = { adds: number; keeps: boolean };

type Measure = { member: (award: MeasuredAward) => MemberId; mark?: (award: MeasuredAward) => Mark };

const measures: Record<LadderId, Measure> = {
  generosity: { member: givenBy },
  recognition: { member: ({ recipient }) => recipient },
  connections: { member: givenBy, mark: ({ recipient }) => ({ group: recipient, key: recipient, distinct: 1 }) },
  dependability: { member: givenBy, mark: ({ day }) => ({ group: day, key: day, distinct: 1 }) },
  applause: { member: givenBy, mark: ({ day, recipient }) => ({ group: day, key: recipient, distinct: 3 }) },
  seasons: { member: givenBy, mark: ({ day }) => ({ group: monthOf(day), key: monthOf(day), distinct: 1 }) },
};

export function countedMemberOf(ladder: LadderId, award: MeasuredAward): MemberId {
  return measures[ladder].member(award);
}

export function markOf(ladder: LadderId, award: MeasuredAward): Mark | null {
  return measures[ladder].mark?.(award) ?? null;
}

export function stepOf(award: MeasuredAward, mark: Mark | null, marked: readonly string[]): Step {
  if (mark === null) return { adds: award.kudos, keeps: false };
  if (marked.length >= mark.distinct || marked.includes(mark.key)) return { adds: 0, keeps: false };
  return { adds: marked.length + 1 === mark.distinct ? 1 : 0, keeps: true };
}

function givenBy({ giver }: MeasuredAward): MemberId {
  return giver;
}

function monthOf(day: DayKey): string {
  return day.slice(0, "yyyy-mm".length);
}
