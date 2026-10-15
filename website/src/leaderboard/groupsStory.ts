import type { GroupsBoardRow, GroupsBoardShown, Period } from "../shell";
import { periodNamed } from "./periods";
import type { Story } from "./story";

const nobodyGaveYet: Record<Period, string> = {
  week: "No group has given kudos this week yet.",
  month: "No group has given kudos this month yet.",
  all: "No group has given kudos yet.",
};

export function nobodyGaveYetOn(period: Period) {
  return nobodyGaveYet[period];
}

export function groupsStoryOf({ rows }: GroupsBoardShown, period: Period): Story | undefined {
  const leaders = rows.filter((row) => row.rank === 1);
  const [leader] = leaders;
  if (leader === undefined || leader.kudos === 0) return undefined;
  return { headline: headlineOf(leaders, periodNamed(period).phrase), deck: `${perPerson(leader.perMember)} kudos given per person, and ${leader.participation}% of them gave.${mineInTheDeck(rows)}` };
}

export function perPerson(score: number) {
  return score.toFixed(1);
}

function headlineOf(leaders: GroupsBoardRow[], phrase: string) {
  const [leader] = leaders;
  if (leaders.length > 1) return `${namesOf(leaders)} share the lead.`;
  return leader!.mine ? `Your group leads ${phrase}.` : `${leader!.name} leads ${phrase}.`;
}

function mineInTheDeck(rows: GroupsBoardRow[]) {
  const mine = rows.find((row) => row.mine);
  return mine === undefined || mine.rank === 1 ? "" : ` ${mine.name} sits at No. ${mine.rank}.`;
}

function namesOf(rows: GroupsBoardRow[]) {
  const names = rows.map((row) => row.name);
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
