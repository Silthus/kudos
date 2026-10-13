// Variant E standing facts: the viewer's place on each board this week, the rows directly above and below, and the change in places since last week.
import { boards, me } from "../../data/mock";
import type { BoardRow, GroupRow } from "../../data/types";
import type { Board } from "./leaderboard-route";
import { tiedRanks } from "./leaderboard-story";

export type Neighbour = { name: string; value: string; mine?: boolean };

export type BoardStanding = {
  board: Board;
  label: string;
  scope: string;
  unit: string;
  faces: "people" | "groups";
  rank: number;
  tied: boolean;
  change?: number;
  above?: Neighbour;
  you: Neighbour;
  below?: Neighbour;
};

const thisWeek = boards.week;

const placeChangeSinceLastWeek: Partial<Record<Board, number>> = { groups: 1, everyone: 4 };

const person = (row: BoardRow | undefined): Neighbour | undefined => (row?.kind === "row" ? { name: row.me ? "You" : row.name, value: `${row.kudos}`, mine: row.me } : undefined);

const team = (row: GroupRow | undefined): Neighbour | undefined => (row?.kind === "row" ? { name: row.group, value: row.score.toFixed(1), mine: row.mine } : undefined);

function around<Row extends BoardRow | GroupRow>(rows: Row[], isMine: (row: Row) => boolean, toNeighbour: (row: Row | undefined) => Neighbour | undefined) {
  const index = rows.findIndex(isMine);
  const mine = rows[index];
  if (!mine || mine.kind !== "row") return undefined;
  return { rank: mine.rank, tied: tiedRanks(rows)(mine.rank), above: toNeighbour(rows[index - 1]), you: toNeighbour(mine)!, below: toNeighbour(rows[index + 1]) };
}

const isMe = (row: BoardRow) => row.kind === "row" && Boolean(row.me);
const isMine = (row: GroupRow) => row.kind === "row" && Boolean(row.mine);

const places = {
  group: () => around(thisWeek.myGroup.rows, isMe, person),
  groups: () => around(thisWeek.groups.rows, isMine, team),
  everyone: () => around(thisWeek.everyone.rows, isMe, person),
};

const boardFacts: Record<Board, Pick<BoardStanding, "label" | "scope" | "unit" | "faces">> = {
  group: { label: "My group", scope: me.primaryGroup.name, unit: "kudos given", faces: "people" },
  groups: { label: "Groups", scope: "Kudos per person", unit: "kudos given per person", faces: "groups" },
  everyone: { label: "Everyone", scope: "Whole company", unit: "kudos given", faces: "people" },
};

export function boardStanding(board: Board): BoardStanding | undefined {
  const place = places[board]();
  return place && { board, ...boardFacts[board], change: placeChangeSinceLastWeek[board], ...place };
}
