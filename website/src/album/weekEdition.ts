import { useCallback, useEffect, useRef, useState } from "react";
import type { AlbumWeek, WeekRead, WeekShown } from "./answer";
import type { AddressedChoice } from "./boardPeriods";

export type WeekEdition = { shown: WeekShown | undefined; chosen: string | undefined; thisWeek: string | undefined; loading: boolean; choose: (week: string) => void };

export function useWeekEdition(read: WeekRead, asking: boolean, addressed: AddressedChoice<string | undefined> | null = null): WeekEdition {
  const [chosenHere, setChosenHere] = useState<string>();
  const [thisWeek, setThisWeek] = useState<string>();
  const [wasAsking, setWasAsking] = useState(asking);
  if (asking !== wasAsking) {
    setWasAsking(asking);
    setChosenHere(undefined);
    setThisWeek(undefined);
  }
  const { chosen, choose: setChosen } = addressed ?? { chosen: chosenHere, choose: setChosenHere };
  const answer = read(asking, asking ? chosen : undefined);
  if (chosen === undefined && answer?.kind === "week" && answer.week !== thisWeek) setThisWeek(answer.week);
  const lastAnswered = useLastAnswered(answer, asking);
  const choose = useCallback((week: string) => setChosen(week === thisWeek ? undefined : week), [setChosen, thisWeek]);
  const waiting = answer === undefined || answer.kind === "off";
  const loading = waiting && lastAnswered !== undefined;
  return { shown: loading ? lastAnswered : answer, chosen: chosen ?? thisWeek, thisWeek, loading, choose };
}

function useLastAnswered(answer: WeekShown | undefined, asking: boolean): AlbumWeek | undefined {
  const last = useRef<AlbumWeek>(undefined);
  useEffect(() => {
    if (!asking) last.current = undefined;
    else if (answer?.kind === "week") last.current = answer;
  }, [answer, asking]);
  return last.current;
}

export function isWaitingForTheWeek({ shown }: WeekEdition) {
  return shown === undefined || shown.kind === "off";
}
