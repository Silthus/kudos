// Variant E leaderboard copy: the headline and subline that name the leader and place the viewer.
import type { BoardRow, GroupRow } from "../../data/types";

export type PersonRow = Extract<BoardRow, { kind: "row" }>;
export type TeamRow = Extract<GroupRow, { kind: "row" }>;

const joinNames = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

export function groupStory(rows: GroupRow[], phrase: string) {
  const ranked = rows.filter((r): r is TeamRow => r.kind === "row");
  const leaders = ranked.filter((r) => r.rank === 1);
  const headline = leaders.length > 1 ? `${joinNames(leaders.map((l) => l.group))} share the lead.` : `${leaders[0]?.group} leads ${phrase}.`;
  const mine = ranked.find((r) => r.mine);
  const yours = mine && mine.rank > 1 ? ` ${mine.group} sits at No. ${mine.rank}.` : "";
  const deck = `${leaders[0]?.score.toFixed(1)} kudos given per person, and ${leaders[0]?.participation}% of them gave.${yours}`;
  return { headline, deck };
}

export function peopleStory(rows: BoardRow[], phrase: string, showMe: boolean) {
  const ranked = rows.filter((r): r is PersonRow => r.kind === "row");
  const leaders = ranked.filter((r) => r.rank === 1);
  const name = (r: PersonRow) => (r.me ? "You" : r.name);
  const headline = leaders.length > 1 ? `${joinNames(leaders.map(name))} share the lead.` : leaders[0]?.me ? `You lead ${phrase}.` : `${leaders[0]?.name} leads ${phrase}.`;
  const mine = ranked.find((r) => r.me);
  const tied = mine ? ranked.filter((r) => r.rank === mine.rank && !r.me) : [];
  const yours = mine && mine.rank > 1 ? ` You're No. ${mine.rank} with ${mine.kudos}${tied.length > 0 ? `, tied with ${joinNames(tied.map((t) => t.name))}` : ""}.` : "";
  const deck = `${leaders[0]?.kudos} kudos given.${showMe ? yours : " You're off the board by choice."}`;
  return { headline, deck };
}
