import type { LeaderboardRow } from "../shell";
import type { PeopleBoard } from "./boards";
import { periodNamed } from "./periods";

export type Story = { headline: string; deck: string };

export function storyOf(board: PeopleBoard): Story | undefined {
  const leaders = board.rows.filter((row) => row.rank === 1);
  const [leader] = leaders;
  if (leader === undefined) return undefined;
  return { headline: headlineOf(leaders, periodNamed(board.period).phrase), deck: `${leader.kudos} kudos given.${standingInTheDeck(board)}` };
}

function headlineOf(leaders: LeaderboardRow[], phrase: string) {
  const [leader] = leaders;
  if (leaders.length > 1) return `${namesOf(leaders)} share the lead.`;
  return leader!.you ? `You lead ${phrase}.` : `${leader!.name} leads ${phrase}.`;
}

function standingInTheDeck({ standing, rows }: PeopleBoard) {
  if (standing.kind === "left") return " You're off the board by choice.";
  if (standing.kind !== "ranked" || standing.rank === 1) return "";
  const mine = rows[standing.position - 1]!;
  const tiedWith = rows.filter((row) => row.rank === standing.rank && !row.you);
  const ties = tiedWith.length > 0 ? `, tied with ${namesOf(tiedWith)}` : "";
  return ` You're No. ${standing.rank} with ${mine.kudos}${ties}.`;
}

function namesOf(rows: LeaderboardRow[]) {
  const names = [...rows.filter((row) => row.you).map(() => "You"), ...rows.filter((row) => !row.you).map((row) => row.name)];
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
