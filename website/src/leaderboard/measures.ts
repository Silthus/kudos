import { useEffect, useRef, useState } from "react";
import type { HugBoards, HugMeasure } from "../../../convex/website/leaderboard";
import type { HugBoardsRead, HugBoardsShown } from "../album/answer";

export type HugBoardsOfMeasure = { shown: HugBoardsShown | undefined; measure: HugMeasure; choose: (measure: HugMeasure) => void };

export function useHugBoardsOfMeasure(read: HugBoardsRead, asking: boolean): HugBoardsOfMeasure {
  const [measure, choose] = useState<HugMeasure>("hugsGiven");
  const answer = read(asking, measure);
  const lastBoards = useLastBoards(answer, asking);
  return { shown: isWaitingForTheWeeksBoards(answer) && lastBoards !== undefined ? lastBoards : answer, measure, choose };
}

function useLastBoards(answer: HugBoardsShown | undefined, asking: boolean): HugBoards | undefined {
  const last = useRef<HugBoards>(undefined);
  useEffect(() => {
    if (!asking) last.current = undefined;
    else if (answer?.kind === "boards") last.current = answer;
  }, [answer, asking]);
  return last.current;
}

export function isWaitingForTheWeeksBoards(shown: HugBoardsShown | undefined): shown is undefined | { kind: "off" } {
  return shown === undefined || shown.kind === "off";
}
