import type { ViewedBoard } from "../analytics/projections";
import type { GroupId } from "../groups/groups";
import type { BoardRow, BoardView } from "../leaderboard/board";
import type { GroupImprovement, GroupsBoard, GroupsBoardRow } from "../leaderboard/groupsBoard";
import { improvementLine, placesClimbedPart } from "../leaderboard/improvementLine";
import type { MyGroupBoardView } from "../leaderboard/myGroupBoard";
import type { Peer } from "../leaderboard/peer";
import type { Period } from "../leaderboard/periods";
import type { EveryoneBoardView } from "../leaderboard/totals";
import { asWritten } from "./groupCopy";
import { slashCommand } from "./naming";
import type { Line } from "./segments";

const medals = ["🥇", "🥈", "🥉"];

const joinTheBoard: Record<Period, string> = {
  week: "Give kudos this week to join the board.",
  month: "Give kudos this month to join the board.",
  all: "Give kudos to join the board.",
};

export type ShownBoard = { board: ViewedBoard; lines: Line[] };

export function renderEveryoneBoard(view: EveryoneBoardView, period: Period): Line[] {
  const improvement = view.improvement === null || period === "all" ? [] : [[{ text: improvementLine(view.improvement, period) }]];
  return [...renderIndividualBoard(view, period), ...improvement, ...peerLine(view.peer)];
}

export function renderBoards(groups: GroupsBoard<GroupId> | null, myGroup: MyGroupBoardView | null, everyone: EveryoneBoardView, period: Period): ShownBoard[] {
  const groupBoards: ShownBoard[] = [
    ...(groups === null || groups.rows.length === 0 ? [] : [{ board: "groups" as const, lines: renderGroupsBoard(groups, period) }]),
    ...(myGroup === null ? [] : [{ board: "my-group" as const, lines: renderMyGroupBoard(myGroup, period) }]),
  ];
  const everyoneBoard = renderEveryoneBoard(everyone, period);
  return [...groupBoards, { board: "everyone", lines: groupBoards.length === 0 ? everyoneBoard : [everyoneHeading, ...everyoneBoard] }];
}

function renderIndividualBoard(view: BoardView, period: Period): Line[] {
  const rows = view.rows.map((row) => ("gap" in row ? [{ text: "…" }] : boardRow(row)));
  return [...rows, ...nudgeFor(view, period)];
}

function renderMyGroupBoard({ group, board }: MyGroupBoardView, period: Period): Line[] {
  return [[{ text: `*${asWritten(group)}*` }], ...renderIndividualBoard(board, period)];
}

function peerLine(peer: Peer | null): Line[] {
  return peer === null ? [] : [[{ text: `You improved more than ${peer.percent}% of ${asWritten(peer.group)}.` }]];
}

function renderGroupsBoard(board: GroupsBoard<GroupId>, period: Period): Line[] {
  const rows = board.window.flatMap((position, index) => [...(skipsBefore(board.window, index) ? [[{ text: "…" }]] : []), groupRow(board.rows[position - 1]!)]);
  const mine = board.rows.find(({ mine }) => mine);
  const improvement = board.improvement === null || mine === undefined || period === "all" ? [] : [[{ text: groupImprovementLine(board.improvement, mine, period) }]];
  const mostImproved = board.mostImproved === null ? [] : [[{ text: `📈 Most improved: ${asWritten(board.mostImproved)}` }]];
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

function nudgeFor({ viewerAbsent }: BoardView, period: Period): Line[] {
  if (viewerAbsent === "left") return [[{ text: "You're not on the leaderboards. You can change that in Settings." }]];
  if (viewerAbsent === "not-ranked") return [[{ text: joinTheBoard[period] }]];
  return [];
}

function boardRow({ rank, id, value }: BoardRow): Line {
  return [{ text: `${medalOf(rank)} ` }, { mention: { kind: "person", user: id } }, { text: ` · ${value} kudos` }];
}

function groupRow(row: GroupsBoardRow<GroupId>): Line {
  const { rank, perMember, participation, kudos } = row;
  return [{ text: `${medalOf(rank)} ${asWritten(row)} · ${perMember.toFixed(1)} per person · ${participation}% gave · ${kudos} kudos` }];
}

function groupImprovementLine(improvement: GroupImprovement, group: GroupsBoardRow<GroupId>, period: Exclude<Period, "all">) {
  if ("best" in improvement) return `${asWritten(group)}'s best ${period} so far: ${improvement.best.toFixed(1)} per person.`;
  return `▲ ${improvement.gain.toFixed(1)} more per person than this time last ${period}${placesClimbedPart(improvement.places)}`;
}

function skipsBefore(window: number[], index: number) {
  return index > 0 && window[index]! > window[index - 1]! + 1;
}

export function medalOf(rank: number) {
  return medals[rank - 1] ?? `${rank}.`;
}
