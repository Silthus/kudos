// PROTOTYPE (#625): the displayed level climbs a beat after the world changes, refilling the ring on a level-up. Never merge to main.
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../../reducedMotion";
import type { Level } from "../world";

export type Climb = Level & { instant: boolean };

const landingBeat = 900;

const fillBeat = 650;

export function useClimb(target: Level): Climb {
  const [shown, setShown] = useState<Climb>({ ...target, instant: true });
  const latest = useRef(shown);
  latest.current = shown;

  useEffect(() => {
    if (target.xp === latest.current.xp) return;
    if (prefersReducedMotion()) {
      setShown({ ...target, instant: true });
      return;
    }
    const timers = target.level > latest.current.level ? levelUpSteps(target, setShown) : [window.setTimeout(() => setShown({ ...target, instant: false }), landingBeat)];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [target]);

  return shown;
}

function levelUpSteps(target: Level, setShown: (climb: Climb | ((current: Climb) => Climb)) => void) {
  return [
    window.setTimeout(() => setShown((current) => ({ ...current, xp: current.nextAt, toNext: 0, progress: 1, instant: false })), landingBeat),
    window.setTimeout(() => setShown({ ...target, xp: target.startsAt, toNext: target.nextAt - target.startsAt, progress: 0, instant: true }), landingBeat + fillBeat),
    window.setTimeout(() => setShown({ ...target, instant: false }), landingBeat + fillBeat + 60),
  ];
}
