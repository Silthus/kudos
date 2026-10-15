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

export type CardStanding = { words: string; rank?: number };

export function peopleStandingOf({ standing, rows }: PeopleBoard): CardStanding {
  switch (standing.kind) {
    case "ranked":
      return { words: rows[standing.position - 1]?.tied ? "You're tied at" : "You're", rank: standing.rank };
    case "not-ranked":
      return { words: "Not ranked yet" };
    case "left":
      return { words: "Off the board" };
  }
}

export function groupsStandingOf({ standing, rows }: GroupsBoardShown): CardStanding {
  switch (standing.kind) {
    case "ranked":
      return { words: rows[standing.position - 1]?.tied ? "Your group is tied at" : "Your group is", rank: standing.rank };
    case "not-listed":
      return { words: "Not listed yet" };
    case "no-group":
      return { words: "No group yet" };
  }
}
