// PROTOTYPE (#625): the shown level climbs a beat after the world changes, with a gain event per climb and count-ups. Never merge to main.
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../../../reducedMotion";
import type { Level } from "../../world";

export type Gain = { serial: number; xp: number; from: number; to: number; levelledTo: number | null };

export type Climb = Level & { instant: boolean; gain: Gain | null };

const landingBeat = 900;

const fillBeat = 700;

export function useClimb(target: Level): Climb {
  const [shown, setShown] = useState<Climb>({ ...target, instant: true, gain: null });
  const latest = useRef(shown);
  latest.current = shown;

  useEffect(() => {
    const before = latest.current;
    if (target.xp === before.xp) return;
    const gain: Gain = { serial: (before.gain?.serial ?? 0) + 1, xp: target.xp - before.xp, from: before.progress, to: target.level > before.level ? 1 : target.progress, levelledTo: target.level > before.level ? target.level : null };
    if (prefersReducedMotion()) {
      setShown({ ...target, instant: true, gain });
      return;
    }
    const timers =
      gain.levelledTo === null
        ? [window.setTimeout(() => setShown({ ...target, instant: false, gain }), landingBeat)]
        : [
            window.setTimeout(() => setShown((current) => ({ ...current, xp: current.nextAt, toNext: 0, progress: 1, instant: false, gain })), landingBeat),
            window.setTimeout(() => setShown({ ...target, xp: target.startsAt, toNext: target.nextAt - target.startsAt, progress: 0, instant: true, gain }), landingBeat + fillBeat),
            window.setTimeout(() => setShown({ ...target, instant: false, gain: { ...gain, from: 0, to: target.progress } }), landingBeat + fillBeat + 60),
          ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [target]);

  return shown;
}

export function useTicking(target: number, { ms = 900, delay = 0, from }: { ms?: number; delay?: number; from?: number } = {}) {
  const [shown, setShown] = useState(from ?? target);
  const current = useRef(from ?? target);
  useEffect(() => {
    const origin = current.current;
    if (origin === target || prefersReducedMotion()) {
      current.current = target;
      setShown(target);
      return;
    }
    const startAt = performance.now() + delay;
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, Math.max(0, (now - startAt) / ms));
      current.current = Math.round(origin + (target - origin) * (1 - (1 - progress) ** 3));
      setShown(current.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, ms, delay]);
  return shown;
}

export function useLagging<T>(value: T, ms: number) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return shown;
}

export function useExpiring<T>(ms: number): [T | null, (value: T | null) => void] {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    if (value === null) return;
    const timer = window.setTimeout(() => setValue(null), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return [value, setValue];
}
