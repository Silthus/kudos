// PROTOTYPE (#625): World map motion helpers: count-ups, lagging values and the level climb. Never merge to main.
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../../../reducedMotion";
import type { Level } from "../../world";

export { prefersReducedMotion };

export function useTicker(target: number, { from = 0, ms = 900, delay = 0 }: { from?: number; ms?: number; delay?: number } = {}) {
  const [shown, setShown] = useState(prefersReducedMotion() ? target : from);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(target);
      return;
    }
    let frame = 0;
    const startAt = performance.now() + delay;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - startAt) / ms));
      setShown(Math.round(from + (target - from) * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, from, ms, delay]);
  return shown;
}

export function useCountingTo(target: number, lagMs: number) {
  const [settled, setSettled] = useState(target);
  const [from, setFrom] = useState(target);
  useEffect(() => {
    if (target === settled) return;
    const timer = window.setTimeout(() => {
      setFrom(settled);
      setSettled(target);
    }, lagMs);
    return () => window.clearTimeout(timer);
  }, [target, settled, lagMs]);
  return useTicker(settled, { from, ms: 700 });
}

export type Climb = Level & { instant: boolean };

const fillBeat = 650;

export function useClimb(target: Level, landingBeat: number): Climb {
  const [shown, setShown] = useState<Climb>({ ...target, instant: true });
  const latest = useRef(shown);
  latest.current = shown;
  const landing = useRef(landingBeat);
  landing.current = landingBeat;

  useEffect(() => {
    if (target.xp === latest.current.xp) return;
    if (prefersReducedMotion()) {
      setShown({ ...target, instant: true });
      return;
    }
    const timers = target.level > latest.current.level ? levelUpSteps(target, setShown, landing.current) : [window.setTimeout(() => setShown({ ...target, instant: false }), landing.current)];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [target]);

  return shown;
}

function levelUpSteps(target: Level, setShown: (climb: Climb | ((current: Climb) => Climb)) => void, landingBeat: number) {
  return [
    window.setTimeout(() => setShown((current) => ({ ...current, xp: current.nextAt, toNext: 0, progress: 1, instant: false })), landingBeat),
    window.setTimeout(() => setShown({ ...target, xp: target.startsAt, toNext: target.nextAt - target.startsAt, progress: 0, instant: true }), landingBeat + fillBeat),
    window.setTimeout(() => setShown({ ...target, instant: false }), landingBeat + fillBeat + 60),
  ];
}

export function useFleeting<T>(ms: number): [T[], (item: T, delay: number) => void] {
  const [items, setItems] = useState<T[]>([]);
  const add = (item: T, delay: number) => {
    window.setTimeout(() => setItems((current) => [...current, item]), delay);
    window.setTimeout(() => setItems((current) => current.filter((entry) => entry !== item)), delay + ms);
  };
  return [items, add];
}
