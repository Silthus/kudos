import type { GroupId } from "../groups/groups";
import type { BoardRow } from "../leaderboard/board";
import type { GroupImprovement, GroupsBoard, GroupsBoardRow } from "../leaderboard/groupsBoard";
import { improvementLine } from "../leaderboard/improvementLine";
import type { Period } from "../leaderboard/periods";
import type { EveryoneBoardView } from "../leaderboard/totals";
import { slashCommand } from "./naming";
import type { Line } from "./segments";

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

export function renderBoards(groups: GroupsBoard<GroupId> | null, everyone: EveryoneBoardView, period: Period): Line[][] {
  const groupsBoard = groups === null || groups.rows.length === 0 ? [] : renderGroupsBoard(groups, period);
  const everyoneBoard = renderEveryoneBoard(everyone, period);
  return groupsBoard.length === 0 ? [everyoneBoard] : [groupsBoard, [everyoneHeading, ...everyoneBoard]];
}

function renderGroupsBoard(board: GroupsBoard<GroupId>, period: Period): Line[] {
  const rows = board.window.flatMap((position, index) => [...(skipsBefore(board.window, index) ? [[{ text: "…" }]] : []), groupRow(board.rows[position - 1]!)]);
  const mine = board.rows.find(({ mine }) => mine);
  const improvement = board.improvement === null || mine === undefined || period === "all" ? [] : [[{ text: groupImprovementLine(board.improvement, mine.name, period) }]];
  const mostImproved = board.mostImproved === null ? [] : [[{ text: `📈 Most improved: ${board.mostImproved.name}` }]];
  return [[{ text: "*Groups*" }], ...rows, ...improvement, ...mostImproved];
}

const everyoneHeading: Line = [{ text: "*Everyone*" }];

export function renderFullBoardLink(website: string | null): Line[] {
  return website === null ? [] : [[{ link: { url: website, label: "See the full leaderboard on the web" } }]];
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

function groupRow({ rank, name, perMember, participation, kudos }: GroupsBoardRow<GroupId>): Line {
  return [{ text: `${medalOf(rank)} ${name} · ${perMember.toFixed(1)} per person · ${participation}% gave · ${kudos} kudos` }];
}

function groupImprovementLine(improvement: GroupImprovement, group: string, period: Exclude<Period, "all">) {
  if ("best" in improvement) return `${group}'s best ${period} so far: ${improvement.best.toFixed(1)} per person.`;
  const places = improvement.places === undefined ? "" : ` · ▲ ${improvement.places} places`;
  return `▲ ${improvement.gain.toFixed(1)} more per person than this time last ${period}${places}`;
}

function skipsBefore(window: number[], index: number) {
  return index > 0 && window[index]! > window[index - 1]! + 1;
}

function medalOf(rank: number) {
  return medals[rank - 1] ?? `${rank}.`;
}
