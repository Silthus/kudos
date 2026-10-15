import type { GroupsBoardShown, Leaderboard } from "../shell";

export type BoardId = "groups" | "my-group" | "everyone";

export type PeopleBoard = Pick<Leaderboard, "period" | "chatUrl" | "rows" | "window" | "standing">;

export function boardsOn({ groups, myGroup }: Leaderboard): BoardId[] {
  return [...(groups === null ? [] : (["groups"] as const)), ...(myGroup === null ? [] : (["my-group"] as const)), "everyone"];
}

export function firstBoardOn({ myGroup }: Leaderboard): BoardId {
  return myGroup === null ? "everyone" : "my-group";
}

export function peopleBoardOf(board: Leaderboard, chosen: Exclude<BoardId, "groups">): PeopleBoard {
  if (chosen === "everyone" || board.myGroup === null) return board;
  const { rows, window, standing } = board.myGroup;
  return { period: board.period, chatUrl: board.chatUrl, rows, window, standing };
}

export function peopleStandingOf({ standing, rows }: PeopleBoard) {
  switch (standing.kind) {
    case "ranked":
      return rows[standing.position - 1]?.tied ? `You're tied at #${standing.rank}` : `You're #${standing.rank}`;
    case "not-ranked":
      return "Not ranked yet";
    case "left":
      return "Off the board";
  }
}

export function groupsStandingOf({ standing, rows }: GroupsBoardShown) {
  switch (standing.kind) {
    case "ranked":
      return rows[standing.position - 1]?.tied ? `Your group is tied at #${standing.rank}` : `Your group is #${standing.rank}`;
    case "not-listed":
      return "Not listed yet";
    case "no-group":
      return "No group yet";
  }
}
