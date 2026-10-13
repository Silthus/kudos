import type { BoardRow, BoardView } from "../leaderboard/board";
import { slashCommand } from "./naming";
import type { Line } from "./replies";

const medals = ["🥇", "🥈", "🥉"];

export function renderEveryoneBoard(view: BoardView): Line[] {
  const rows = view.rows.map((row) => ("gap" in row ? [{ text: "…" }] : boardRow(row)));
  return view.viewerAbsent === "not-ranked" ? [...rows, [{ text: "Give kudos this week to join the board." }]] : rows;
}

export function renderLeaderboardUsage(): Line[] {
  const forms = ["", " month", " all"].map((period) => `\`${slashCommand} leaderboard${period}\``);
  return [[{ text: `Try ${forms[0]}, ${forms[1]} or ${forms[2]}.` }]];
}

function boardRow({ rank, id, value }: BoardRow): Line {
  return [{ text: `${medalOf(rank)} ` }, { mention: { kind: "person", user: id } }, { text: ` · ${value} kudos` }];
}

function medalOf(rank: number) {
  return medals[rank - 1] ?? `${rank}.`;
}
