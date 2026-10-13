// Variant E leaderboard route: the board and period live in #/leaderboard/<board>[.<period>], and a bare period still works for old links.
import type { Period } from "../../data/types";

export type Board = "groups" | "group" | "everyone";

export const defaultBoard: Board = "group";

const boardWords: Record<string, Board> = { groups: "groups", group: "group", "my-group": "group", mygroup: "group", everyone: "everyone" };
const periodWords: Period[] = ["week", "month", "all"];

export function readRoute(param?: string): { board: Board; period: Period } {
  const words = (param ?? "").toLowerCase().split(/[.,+]/);
  const board = words.map((w) => boardWords[w]).find((b): b is Board => Boolean(b)) ?? defaultBoard;
  const period = periodWords.find((p) => words.includes(p)) ?? "week";
  return { board, period };
}

export function writeRoute(board: Board, period: Period) {
  location.replace(`#/leaderboard/${period === "week" ? board : `${board}.${period}`}`);
}
