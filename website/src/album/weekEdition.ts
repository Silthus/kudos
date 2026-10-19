import { useCallback, useState } from "react";
import type { AlbumWeek, WeekRead, WeekShown } from "./answer";

export type WeekEdition = { shown: WeekShown | undefined; chosen: string | undefined; thisWeek: string | undefined; loading: boolean; choose: (week: string) => void };

type Seen = { last?: AlbumWeek; thisWeek?: string };

export function useWeekEdition(read: WeekRead, asking: boolean): WeekEdition {
  const [chosen, setChosen] = useState<string>();
  const [seen, setSeen] = useState<Seen>({});
  const [wasAsking, setWasAsking] = useState(asking);
  if (asking !== wasAsking) {
    setWasAsking(asking);
    setChosen(undefined);
    setSeen({});
  }
  const answer = read(asking, asking ? chosen : undefined);
  if (answer?.kind === "week" && isNewTo(seen, answer, chosen)) setSeen({ last: answer, thisWeek: chosen === undefined ? answer.week : seen.thisWeek });
  const choose = useCallback((week: string) => setChosen(week === seen.thisWeek ? undefined : week), [seen.thisWeek]);
  const waiting = answer === undefined || answer.kind === "off";
  const loading = waiting && seen.last !== undefined;
  return { shown: loading ? seen.last : answer, chosen: chosen ?? seen.thisWeek, thisWeek: seen.thisWeek, loading, choose };
}

function isNewTo(seen: Seen, answer: AlbumWeek, chosen: string | undefined) {
  return seen.last?.week !== answer.week || (chosen === undefined && seen.thisWeek !== answer.week);
}

export function isWaitingForTheWeek({ shown }: WeekEdition) {
  return shown === undefined || shown.kind === "off";
}
