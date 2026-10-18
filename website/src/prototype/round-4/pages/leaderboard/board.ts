// PROTOTYPE (#625, round 4): the leaderboard's boards, people and teams ranked by thoughtful kudos given, drawn deterministically from the album. Never merge to main.
import type { TeamArt } from "../../../../crates/TeamCrest";
import type { Face } from "../../../../shell";
import type { Album } from "../../../round-3/album";

export type Period = "week" | "month" | "all";

export const periods: { period: Period; label: string; phrase: string }[] = [
  { period: "week", label: "This week", phrase: "the week" },
  { period: "month", label: "This month", phrase: "the month" },
  { period: "all", label: "All time", phrase: "all time" },
];

export function periodNamed(period: Period) {
  return periods.find((each) => each.period === period)!;
}

export type PersonRow = { key: string; rank: number; tied: boolean; name: string; face: Face; team: { team: string; name: string; art: TeamArt } | null; thoughtful: number; climbed: number | null; you: boolean; collected: boolean };

export type TeamRow = { team: string; rank: number; tied: boolean; name: string; art: TeamArt; mine: boolean; perPerson: number; thoughtful: number; gave: number; size: number; held: number; total: number; climbed: number | null };

function seedOf(text: string, salt: number) {
  const hashed = [...`${salt}:${text}`].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16_777_619), 2_166_136_261);
  return avalanche(hashed) >>> 0;
}

function avalanche(hash: number) {
  const first = Math.imul(hash ^ (hash >>> 16), 0x85eb_ca6b);
  const second = Math.imul(first ^ (first >>> 13), 0xc2b2_ae35);
  return second ^ (second >>> 16);
}

const weeklyShares: readonly [belowPerMille: number, gave: number][] = [
  [400, 0],
  [720, 1],
  [880, 2],
  [940, 3],
  [966, 4],
];

const topGiversFrom = 966;

function weekOf(key: string) {
  const roll = seedOf(key, 2) % 1000;
  if (roll >= topGiversFrom) return 5 + Math.floor((roll - topGiversFrom) / 4);
  return weeklyShares.find(([below]) => roll < below)![1];
}

function scoreOf(key: string, period: Period) {
  const week = weekOf(key);
  const month = week + (seedOf(key, 12) % 100 < 40 ? 0 : seedOf(key, 13) % 14);
  if (period === "week") return week;
  if (period === "month") return month;
  return month + (seedOf(key, 4) % 100 < 20 ? 0 : seedOf(key, 5) % 28);
}

function climbedOf(key: string) {
  return seedOf(key, 6) % 6 === 0 ? 1 + (seedOf(key, 7) % 4) : null;
}

function myScoreOf(album: Album, period: Period) {
  const week = album.board.find(({ you }) => you)?.thoughtful ?? 0;
  if (period === "week") return week;
  if (period === "month") return week + 11;
  return album.milestones.find(({ id }) => id === "thoughtful")?.count ?? week;
}

function ranked<Row>(rows: Row[], score: (row: Row) => number, tiebreak: (first: Row, second: Row) => number): (Row & { rank: number; tied: boolean })[] {
  const sorted = rows.toSorted((first, second) => score(second) - score(first) || tiebreak(first, second));
  return sorted.map((row) => {
    const rank = 1 + sorted.filter((other) => score(other) > score(row)).length;
    const tied = sorted.filter((other) => score(other) === score(row)).length > 1;
    return { ...row, rank, tied };
  });
}

export function peopleBoardOf(album: Album, period: Period): PersonRow[] {
  const teamOf = (teams: string[]) => {
    const team = album.teams.find(({ team: slug }) => slug === teams[0]);
    return team === undefined ? null : { team: team.team, name: team.name, art: team.art };
  };
  const others = album.people.map((person) => ({ key: person.key, name: person.name, face: person.face, team: teamOf(person.teams), thoughtful: scoreOf(person.key, period), climbed: climbedOf(person.key), you: false, collected: person.collectedAt !== null }));
  const mine = album.teams.find(({ mine: isMine }) => isMine);
  const me = { key: album.me.key, name: album.me.name, face: album.me.face, team: mine === undefined ? null : { team: mine.team, name: mine.name, art: mine.art }, thoughtful: myScoreOf(album, period), climbed: 2, you: true, collected: true };
  const givers = [...others, me].filter(({ thoughtful }) => thoughtful > 0);
  return ranked(givers, ({ thoughtful }) => thoughtful, (first, second) => Number(second.you) - Number(first.you) || first.name.localeCompare(second.name));
}

export function teamBoardOf(album: Album, period: Period): TeamRow[] {
  const people = peopleBoardOf(album, period);
  const scoreOfKey = new Map(people.map(({ key, thoughtful }) => [key, thoughtful]));
  const rows = album.teams.map((team) => {
    const members = team.mine ? [...team.people, album.me.key] : team.people;
    const scores = members.map((key) => scoreOfKey.get(key) ?? 0);
    const thoughtful = scores.reduce((sum, score) => sum + score, 0);
    const perPerson = Math.round((thoughtful / members.length) * 10) / 10;
    return { team: team.team, name: team.name, art: team.art, mine: team.mine, perPerson, thoughtful, total: team.total, held: team.held, gave: scores.filter((score) => score > 0).length, size: members.length, climbed: climbedOf(team.team) };
  });
  return ranked(rows, ({ perPerson }) => perPerson, (first, second) => second.gave / second.size - first.gave / first.size || first.name.localeCompare(second.name));
}

export function participationOf({ gave, size }: TeamRow) {
  return Math.round((gave / size) * 100);
}

export function perPersonWords(score: number) {
  return score.toFixed(1);
}

export type Story = { headline: string; deck: string };

export function peopleStoryOf(rows: PersonRow[], period: Period): Story {
  const leaders = rows.filter(({ rank }) => rank === 1);
  const me = rows.find(({ you }) => you);
  const phrase = periodNamed(period).phrase;
  const headline = leaders.length > 1 ? `${namesOf(leaders.map(({ name, you }) => (you ? "You" : name)))} share the lead.` : leaders[0]!.you ? `You lead ${phrase}.` : `${leaders[0]!.name} leads ${phrase}.`;
  const standing = me === undefined || me.rank === 1 ? "" : ` You're No. ${me.rank} with ${me.thoughtful}.`;
  return { headline, deck: `${leaders[0]!.thoughtful} thoughtful kudos given.${standing}` };
}

export function teamStoryOf(rows: TeamRow[], period: Period): Story {
  const [leader] = rows;
  const mine = rows.find(({ mine: isMine }) => isMine);
  const phrase = periodNamed(period).phrase;
  const headline = leader!.mine ? `Your team leads ${phrase}.` : `${leader!.name} leads ${phrase}.`;
  const standing = mine === undefined || mine.rank === 1 ? "" : ` ${mine.name} sits at No. ${mine.rank}.`;
  return { headline, deck: `${perPersonWords(leader!.perPerson)} thoughtful kudos per person, and ${participationOf(leader!)}% of them gave.${standing}` };
}

function namesOf(names: string[]) {
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function gapAboveOf(rows: PersonRow[]) {
  const me = rows.find(({ you }) => you);
  if (me === undefined || me.rank === 1) return undefined;
  const above = rows.findLast(({ thoughtful }) => thoughtful > me.thoughtful)!;
  return { name: above.name, rank: above.rank, more: above.thoughtful - me.thoughtful + 1 };
}

export function myWeeklyRankOf(album: Album) {
  return peopleBoardOf(album, "week").find(({ you }) => you)?.rank ?? null;
}
