// Variant E leaderboard boards: mock whole boards per period, Everyone with forty people, My group with all of Team Bramble and Groups with all five, keeping the shared mock's top rows.
import { boards, me, members } from "../../data/mock";
import type { Member, Period } from "../../data/types";
import type { PersonRow, TeamRow } from "./leaderboard-story";

export type WholeBoards = { everyone: PersonRow[]; myGroup: PersonRow[]; groups: TeamRow[] };

const newcomers = [
  "Rosa Eklund", "Sami Varga", "Tess Morrow", "Uma Castell", "Vik Arendt", "Wren Talbot", "Xavi Moreno", "Yara Nilsen",
  "Zeke Hollis", "Alba Ferrer", "Bram Oduya", "Cora Lindgren", "Dario Pesce", "Elin Strand", "Fen Achebe", "Greta Holt",
  "Hal Mercer", "Ines Barros", "Joel Kearney", "Kira Tamm", "Luca Brenner", "Mara Iwu", "Nils Aaberg",
];

const brambleNewcomer = newcomers[0];

const person = (name: string, index: number): Member => ({ id: `n${index}`, name, hue: (index * 47) % 360, initials: name.split(" ").map((p) => p[0]).join("") });

const everybody: Member[] = [...members, ...newcomers.map(person)];

const brambleNames = new Set([members[0], members[2], members[4], members[6], members[8]].map((m) => m.name).concat(me.name, brambleNewcomer));

type Tail = { pinned: Record<string, number>; kudos: (i: number) => number };

const tails: Record<Period, Tail> = {
  week: { pinned: { [members[8].name]: 1, [brambleNewcomer]: 1 }, kudos: (i) => (i < 4 ? 2 : 1) },
  month: { pinned: { [members[6].name]: 9, [members[8].name]: 4, [brambleNewcomer]: 2 }, kudos: (i) => (i < 7 ? [16, 16, 15, 15, 14, 14, 14][i] : Math.max(1, 9 - Math.floor((i - 7) / 3))) },
  all: { pinned: { [members[6].name]: 13, [members[8].name]: 9, [brambleNewcomer]: 5 }, kudos: (i) => Math.max(1, Math.round(38 * (1 - i / 27))) },
};

function ranked(people: Array<Omit<PersonRow, "kind" | "position" | "rank">>): PersonRow[] {
  const sorted = people.map((p, order) => ({ p, order })).sort((a, b) => b.p.kudos - a.p.kudos || a.order - b.order);
  return sorted.map(({ p }, i) => ({ kind: "row", ...p, position: i + 1, rank: 1 + sorted.filter((s) => s.p.kudos > p.kudos).length }));
}

function wholeEveryone(period: Period): PersonRow[] {
  const top = boards[period].everyone.rows.filter((r): r is PersonRow => r.kind === "row");
  const onTop = new Set(top.map((r) => r.name));
  const { pinned, kudos } = tails[period];
  let next = 0;
  const rest = everybody
    .filter((m) => !onTop.has(m.name))
    .map((m) => ({ name: m.name, initials: m.initials, hue: m.hue, kudos: pinned[m.name] ?? kudos(next++) }));
  return ranked([...top.map(({ name, initials, hue, kudos, me }) => ({ name, initials, hue, kudos, me })), ...rest]);
}

function wholeBoards(period: Period): WholeBoards {
  const everyone = wholeEveryone(period);
  const myGroup = ranked(everyone.filter((r) => brambleNames.has(r.name)).map(({ name, initials, hue, kudos, me }) => ({ name, initials, hue, kudos, me })));
  const groups = boards[period].groups.rows.filter((r): r is TeamRow => r.kind === "row");
  return { everyone, myGroup, groups };
}

export const wholeBoardsByPeriod: Record<Period, WholeBoards> = { week: wholeBoards("week"), month: wholeBoards("month"), all: wholeBoards("all") };
