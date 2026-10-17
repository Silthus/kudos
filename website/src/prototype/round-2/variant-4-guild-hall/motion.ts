// PROTOTYPE (#625) round 2 variant 4: the climbing level, count-ups and short-lived HUD moments. Never merge to main.
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../../../reducedMotion";
import type { Level } from "../../world";

export type Climb = Level & { instant: boolean; burst: number };

const defaultLanding = 900;

const fillBeat = 700;

export function useClimb(target: Level, landing = defaultLanding): Climb {
  const [shown, setShown] = useState<Climb>({ ...target, instant: true, burst: 0 });
  const latest = useRef(shown);
  latest.current = shown;

  useEffect(() => {
    if (target.xp === latest.current.xp) return;
    if (prefersReducedMotion()) {
      setShown((current) => ({ ...target, instant: true, burst: current.burst + (target.level > current.level ? 1 : 0) }));
      return;
    }
    const levelledUp = target.level > latest.current.level;
    const timers = levelledUp ? levelUpSteps(target, setShown, landing) : [window.setTimeout(() => setShown((current) => ({ ...target, instant: false, burst: current.burst })), landing)];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [target]);

  return shown;
}

type SetClimb = (next: (current: Climb) => Climb) => void;

function levelUpSteps(target: Level, setShown: SetClimb, landingBeat: number) {
  return [
    window.setTimeout(() => setShown((current) => ({ ...current, xp: current.nextAt, toNext: 0, progress: 1, instant: false })), landingBeat),
    window.setTimeout(() => setShown((current) => ({ ...target, xp: target.startsAt, toNext: target.nextAt - target.startsAt, progress: 0, instant: true, burst: current.burst + 1 })), landingBeat + fillBeat),
    window.setTimeout(() => setShown((current) => ({ ...target, instant: false, burst: current.burst })), landingBeat + fillBeat + 80),
  ];
}

export function useTicker(target: number, { from = 0, ms = 900, delay = 0 }: { from?: number; ms?: number; delay?: number } = {}) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? target : from));
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

export function useLagging<T>(value: T, ms: number) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return shown;
}

export type Gain = { id: number; amount: number };

export function useGains(value: number, ms: number) {
  const before = useRef(value);
  const serial = useRef(0);
  const timers = useRef<number[]>([]);
  const [gains, setGains] = useState<Gain[]>([]);
  useEffect(() => {
    const amount = value - before.current;
    before.current = value;
    if (amount <= 0) return;
    serial.current += 1;
    const gain = { id: serial.current, amount };
    setGains((current) => [...current, gain]);
    timers.current.push(window.setTimeout(() => setGains((current) => current.filter(({ id }) => id !== gain.id)), ms));
  }, [value, ms]);
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  return gains;
}

export function useMoment<T>(initial: T | null, ms: number): [T | null, (next: T) => void] {
  const [moment, setMoment] = useState<T | null>(initial);
  useEffect(() => {
    if (moment === null) return;
    const timer = window.setTimeout(() => setMoment(null), ms);
    return () => window.clearTimeout(timer);
  }, [moment, ms]);
  return [moment, setMoment];
}
