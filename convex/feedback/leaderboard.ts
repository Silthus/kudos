import type { BoardRow } from "../leaderboard/board";
import { improvementLine } from "../leaderboard/improvementLine";
import type { Period } from "../leaderboard/periods";
import type { EveryoneBoardView } from "../leaderboard/totals";
import { slashCommand } from "./naming";
import type { Line } from "./replies";

const medals = ["🥇", "🥈", "🥉"];

const joinTheBoard: Record<Period, string> = {
  week: "Give kudos this week to join the board.",
  month: "Give kudos this month to join the board.",
  all: "Give kudos to join the board.",
};

export function renderEveryoneBoard(view: EveryoneBoardView, period: Period): Line[] {
  const rows = view.rows.map((row) => ("gap" in row ? [{ text: "…" }] : boardRow(row)));
  const nudge = nudgeFor(view, period);
  const improvement = view.improvement === null || period === "all" ? [] : [[{ text: improvementLine(view.improvement, period) }]];
  return [...rows, ...nudge, ...improvement];
}

export function renderLeaderboardUsage(): Line[] {
  const forms = ["", " month", " all"].map((period) => `\`${slashCommand} leaderboard${period}\``);
  return [[{ text: `Try ${forms[0]}, ${forms[1]} or ${forms[2]}.` }]];
}

function nudgeFor({ viewerAbsent }: EveryoneBoardView, period: Period): Line[] {
  if (viewerAbsent === "left") return [[{ text: "You're not on the leaderboards. You can change that in Settings." }]];
  if (viewerAbsent === "not-ranked") return [[{ text: joinTheBoard[period] }]];
  return [];
}

function boardRow({ rank, id, value }: BoardRow): Line {
  return [{ text: `${medalOf(rank)} ` }, { mention: { kind: "person", user: id } }, { text: ` · ${value} kudos` }];
}

function medalOf(rank: number) {
  return medals[rank - 1] ?? `${rank}.`;
}
