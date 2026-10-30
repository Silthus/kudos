import type { ViewedBoard } from "../analytics/projections";
import type { GroupId } from "../groups/groups";
import type { BoardRow, BoardView } from "../leaderboard/board";
import type { GroupsBoard, GroupsBoardRow } from "../leaderboard/groupsBoard";
import { givenCount, groupImprovementLine, improvementLine } from "../leaderboard/improvementLine";
import type { MyGroupBoardView } from "../leaderboard/myGroupBoard";
import type { Peer } from "../leaderboard/peer";
import type { Period } from "../leaderboard/periods";
import type { EveryoneBoardView, GivenMeasure } from "../leaderboard/totals";
import { asWritten } from "./groupCopy";
import { slashCommand } from "./naming";
import type { Line } from "./segments";

const medals = ["🥇", "🥈", "🥉"];

const aheadOfEveryone = 100;

const joinTheBoard: Record<GivenMeasure, Record<Period, string>> = {
  kudosGiven: {
    week: "Give kudos this week to join the board.",
    month: "Give kudos this month to join the board.",
    all: "Give kudos to join the board.",
  },
  hugsGiven: {
    week: "Give a hug this week to join the board.",
    month: "Give a hug this month to join the board.",
    all: "Give a hug to join the board.",
  },
};

export type ShownBoard = { board: ViewedBoard; lines: Line[] };

export function renderEveryoneBoard(view: EveryoneBoardView, period: Period): Line[] {
  const improvement = view.improvement === null || period === "all" ? [] : [[{ text: improvementLine(view.improvement, period, view.measure) }]];
  return [...renderIndividualBoard(view, period, view.measure), ...improvement, ...peerLine(view.peer)];
}

export function renderBoards(groups: GroupsBoard<GroupId> | null, myGroup: MyGroupBoardView | null, everyone: EveryoneBoardView, period: Period): ShownBoard[] {
  const groupBoards: ShownBoard[] = [
    ...(groups === null || groups.rows.length === 0 ? [] : [{ board: "groups" as const, lines: renderGroupsBoard(groups, period) }]),
    ...(myGroup === null ? [] : [{ board: "my-group" as const, lines: renderMyGroupBoard(myGroup, period) }]),
  ];
  const everyoneBoard = renderEveryoneBoard(everyone, period);
  return [...groupBoards, { board: "everyone", lines: groupBoards.length === 0 ? everyoneBoard : [everyoneHeading, ...everyoneBoard] }];
}

function renderIndividualBoard(view: BoardView, period: Period, measure: GivenMeasure): Line[] {
  const rows = view.rows.map((row) => ("gap" in row ? [{ text: "…" }] : boardRow(row, measure)));
  return [...rows, ...nudgeFor(view, period, measure)];
}

function renderMyGroupBoard({ group, board }: MyGroupBoardView, period: Period): Line[] {
  return [[{ text: `*${asWritten(group)}*` }], ...renderIndividualBoard(board, period, "kudosGiven")];
}

function peerLine(peer: Peer | null): Line[] {
  return peer === null ? [] : [[{ text: peerText(peer.percent, asWritten(peer.group)) }]];
}

function peerText(percent: number, group: string) {
  return percent >= aheadOfEveryone ? `You improved more than everyone else in ${group}.` : `You improved more than ${percent}% of ${group}.`;
}

function renderGroupsBoard(board: GroupsBoard<GroupId>, period: Period): Line[] {
  const rows = board.window.flatMap((position, index) => [...(skipsBefore(board.window, index) ? [[{ text: "…" }]] : []), groupRow(board.rows[position - 1]!)]);
  const mine = board.rows.find(({ mine }) => mine);
  const improvement = board.improvement === null || mine === undefined || period === "all" ? [] : [[{ text: groupImprovementLine(board.improvement, asWritten(mine), period) }]];
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

function nudgeFor({ viewerAbsent }: BoardView, period: Period, measure: GivenMeasure): Line[] {
  if (viewerAbsent === "left") return [[{ text: "You're not on the leaderboards. You can change that in Settings." }]];
  if (viewerAbsent === "not-ranked") return [[{ text: joinTheBoard[measure][period] }]];
  return [];
}

function boardRow({ rank, id, value }: BoardRow, measure: GivenMeasure): Line {
  return [{ text: `${medalOf(rank)} ` }, { mention: { kind: "person", user: id } }, { text: ` · ${givenCount(value, measure)}` }];
}

function groupRow(row: GroupsBoardRow<GroupId>): Line {
  const { rank, perMember, participation, kudos } = row;
  return [{ text: `${medalOf(rank)} ${asWritten(row)} · ${perMember.toFixed(1)} per person · ${participation}% gave · ${kudos} kudos` }];
}

function skipsBefore(window: number[], index: number) {
  return index > 0 && window[index]! > window[index - 1]! + 1;
}

export function medalOf(rank: number) {
  return medals[rank - 1] ?? `${rank}.`;
}
