import { useEffect, useRef, useState } from "react";
import type { BoardPeriod, BoardsRead, BoardsShown, ThoughtfulBoards } from "./answer";

export type BoardsOfPeriod = { shown: BoardsShown | undefined; shownPeriod: BoardPeriod; period: BoardPeriod; loading: boolean; choose: (period: BoardPeriod) => void };

type Answered = { boards: ThoughtfulBoards; period: BoardPeriod };

export function useBoardsOfPeriod(read: BoardsRead, onLeaderboard: boolean, onProfile: boolean): BoardsOfPeriod {
  const [chosen, setChosen] = useState<BoardPeriod>("week");
  const [wasOnLeaderboard, setWasOnLeaderboard] = useState(onLeaderboard);
  if (onLeaderboard !== wasOnLeaderboard) {
    setWasOnLeaderboard(onLeaderboard);
    setChosen("week");
  }
  const period = onLeaderboard ? chosen : "week";
  const answer = read(onLeaderboard || onProfile, period);
  const lastAnswered = useLastAnswered(answer, period, onLeaderboard);
  if (onLeaderboard && isWaitingForTheBoards(answer) && lastAnswered !== undefined) return { shown: lastAnswered.boards, shownPeriod: lastAnswered.period, period, loading: true, choose: setChosen };
  return { shown: answer, shownPeriod: period, period, loading: false, choose: setChosen };
}

function useLastAnswered(answer: BoardsShown | undefined, period: BoardPeriod, onLeaderboard: boolean): Answered | undefined {
  const last = useRef<Answered>(undefined);
  useEffect(() => {
    if (!onLeaderboard) last.current = undefined;
    else if (answer?.kind === "boards") last.current = { boards: answer, period };
  }, [answer, period, onLeaderboard]);
  return last.current;
}

export function isWaitingForTheBoards(boards: BoardsShown | undefined) {
  return boards === undefined || boards.kind === "off";
}
