// Variant E leaderboard copy: the headline that names the leader, the viewer's standing on each board, and the podium split of the window.
import type { BoardRow, GroupRow } from "../../data/types";

export type PersonRow = Extract<BoardRow, { kind: "row" }>;
export type TeamRow = Extract<GroupRow, { kind: "row" }>;

const joinNames = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

const rankedPeople = (rows: BoardRow[]) => rows.filter((r): r is PersonRow => r.kind === "row");
const rankedTeams = (rows: GroupRow[]) => rows.filter((r): r is TeamRow => r.kind === "row");

export function tiedRanks(rows: Array<BoardRow | GroupRow>) {
  const counts = new Map<number, number>();
  rows.forEach((r) => r.kind === "row" && counts.set(r.rank, (counts.get(r.rank) ?? 0) + 1));
  return (rank: number) => (counts.get(rank) ?? 0) > 1;
}

export function splitPodium<Row extends BoardRow | GroupRow>(rows: Row[]) {
  const firstGap = rows.findIndex((r) => r.kind === "gap");
  const lead = Math.min(3, firstGap === -1 ? rows.length : firstGap);
  return { podium: rows.slice(0, lead) as Array<Extract<Row, { kind: "row" }>>, rest: rows.slice(lead) };
}

export function groupStory(rows: GroupRow[], phrase: string) {
  const ranked = rankedTeams(rows);
  const leaders = ranked.filter((r) => r.rank === 1);
  const mineLeads = leaders.some((l) => l.mine);
  const headline = leaders.length > 1 ? `${joinNames(leaders.map((l) => l.group))} share the lead.` : mineLeads ? `Your group leads ${phrase}.` : `${leaders[0]?.group} leads ${phrase}.`;
  const mine = ranked.find((r) => r.mine);
  const yours = mine && mine.rank > 1 ? ` ${mine.group} sits at No. ${mine.rank}.` : "";
  const deck = `${leaders[0]?.score.toFixed(1)} kudos given per person, and ${leaders[0]?.participation}% of them gave.${yours}`;
  return { headline, deck };
}

export function peopleStory(rows: BoardRow[], phrase: string, showMe: boolean) {
  const ranked = rankedPeople(rows);
  const leaders = ranked.filter((r) => r.rank === 1);
  const name = (r: PersonRow) => (r.me ? "You" : r.name);
  const headline = leaders.length > 1 ? `${joinNames(leaders.map(name))} share the lead.` : leaders[0]?.me ? `You lead ${phrase}.` : `${leaders[0]?.name} leads ${phrase}.`;
  const mine = ranked.find((r) => r.me);
  const tied = mine ? ranked.filter((r) => r.rank === mine.rank && !r.me) : [];
  const yours = mine && mine.rank > 1 ? ` You're No. ${mine.rank} with ${mine.kudos}${tied.length > 0 ? `, tied with ${joinNames(tied.map((t) => t.name))}` : ""}.` : "";
  const deck = `${leaders[0]?.kudos} kudos given.${showMe ? yours : " You're off the board by choice."}`;
  return { headline, deck };
}

export function personStanding(rows: BoardRow[], showMe: boolean) {
  if (!showMe) return { rank: undefined, text: "Off the board", short: "" };
  const mine = rankedPeople(rows).find((r) => r.me);
  if (!mine) return { rank: undefined, text: "Not ranked yet", short: "" };
  return { rank: mine.rank, text: tiedRanks(rows)(mine.rank) ? "You're tied at" : "You're", short: "You" };
}

export function groupStanding(rows: GroupRow[]) {
  const mine = rankedTeams(rows).find((r) => r.mine);
  if (!mine) return { rank: undefined, text: "Not ranked yet", short: "" };
  return { rank: mine.rank, text: "Your group is", short: "Yours" };
}
