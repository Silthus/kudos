import { useEffect, useRef, useState } from "react";
import type { BoardPeriod, BoardsRead, BoardsShown, ThoughtfulBoards } from "./answer";

export type BoardsOfPeriod = { shown: BoardsShown | undefined; period: BoardPeriod; loading: boolean; choose: (period: BoardPeriod) => void };

export function useBoardsOfPeriod(read: BoardsRead, onLeaderboard: boolean, onProfile: boolean): BoardsOfPeriod {
  const [chosen, setChosen] = useState<BoardPeriod>("week");
  const [wasOnLeaderboard, setWasOnLeaderboard] = useState(onLeaderboard);
  if (onLeaderboard !== wasOnLeaderboard) {
    setWasOnLeaderboard(onLeaderboard);
    setChosen("week");
  }
  const period = onLeaderboard ? chosen : "week";
  const answer = read(onLeaderboard || onProfile, period);
  const lastAnswered = useLastAnswered(answer, onLeaderboard);
  const loading = isWaitingForTheBoards(answer) && lastAnswered !== undefined;
  return { shown: loading ? lastAnswered : answer, period, loading, choose: setChosen };
}

function useLastAnswered(answer: BoardsShown | undefined, onLeaderboard: boolean): ThoughtfulBoards | undefined {
  const last = useRef<ThoughtfulBoards>(undefined);
  useEffect(() => {
    if (!onLeaderboard) last.current = undefined;
    else if (answer?.kind === "boards") last.current = answer;
  }, [answer, onLeaderboard]);
  return last.current;
}

export function isWaitingForTheBoards(boards: BoardsShown | undefined) {
  return boards === undefined || boards.kind === "off";
}
