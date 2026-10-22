import type { AlbumWeek, CardWeek, KudosOfTheWeek, PlayerCard, WeekKudos } from "./answer";

export type SaidLine = { kudos: WeekKudos; toSubject: boolean };

export type PageWeek = { days: number[]; thanked: number; thankedBy: number; packsOpened: number; hugs: number; kudosOfWeek: KudosOfTheWeek | null; lines: SaidLine[] | null };

export type EmojiStack = { count: number; shown: { name: string; picture: string }[] };

export const latestLinesShown = 2;

const aQuietWeek = [0, 0, 0, 0, 0, 0, 0];

export function ownWeekOf({ issue }: AlbumWeek): PageWeek {
  if (issue === null) return { days: aQuietWeek, thanked: 0, thankedBy: 0, packsOpened: 0, hugs: 0, kudosOfWeek: null, lines: [] };
  return {
    days: issue.days,
    thanked: issue.thanked.people.length + issue.thanked.more,
    thankedBy: issue.thankedBy.people.length + issue.thankedBy.more,
    packsOpened: issue.packsOpened,
    hugs: issue.hugsGiven + issue.hugsReceived,
    kudosOfWeek: issue.kudosOfWeek,
    lines: [...issue.received.kudos.map((kudos) => ({ kudos, toSubject: true })), ...issue.given.kudos.map((kudos) => ({ kudos, toSubject: false }))].toSorted((one, other) => other.kudos.at - one.kudos.at).slice(0, latestLinesShown),
  };
}

export function teammateWeekOf({ kudosOfWeek, ...totals }: CardWeek): PageWeek {
  return { ...totals, kudosOfWeek, lines: null };
}

export function isAQuietWeek({ days, kudosOfWeek, lines }: PageWeek) {
  return days.every((count) => count === 0) && kudosOfWeek === null && (lines ?? []).length === 0;
}

export function isAQuietCard({ hoggies, people, medals }: PlayerCard, emojis: EmojiStack) {
  return (hoggies?.found ?? 0) + people.held + emojis.count + medals.count === 0;
}

export function levelShareOf({ xp, startsAt, nextAt }: NonNullable<PlayerCard["level"]>) {
  return nextAt <= startsAt ? 1 : Math.min(1, Math.max(0, (xp - startsAt) / (nextAt - startsAt)));
}
