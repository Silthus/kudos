// PROTOTYPE (#625): the displayed level and coins climb a beat after the world changes, held while a reveal is on screen. Never merge to main.
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../../../reducedMotion";
import type { Level } from "../../world";

export type Gain = { amount: number; from: number; to: number; serial: number };

export type Climb = Level & { instant: boolean; gain: Gain | null; levelledAt: number | null };

const landingBeat = 450;

const fillBeat = 700;

export function useClimb(target: Level, held: boolean): Climb {
  const [shown, setShown] = useState<Climb>({ ...target, instant: true, gain: null, levelledAt: null });
  const latest = useRef(shown);
  latest.current = shown;

  useEffect(() => {
    if (held || target.xp === latest.current.xp) return;
    const before = latest.current;
    const serial = (before.gain?.serial ?? 0) + 1;
    const levelled = target.level > before.level;
    const gain: Gain = { amount: target.xp - before.xp, from: before.progress, to: levelled ? 1 : target.progress, serial };
    if (prefersReducedMotion()) {
      setShown({ ...target, instant: true, gain, levelledAt: levelled ? target.level : before.levelledAt });
      return;
    }
    const timers = levelled ? levelUpSteps(target, gain, setShown) : [window.setTimeout(() => setShown({ ...target, instant: false, gain, levelledAt: before.levelledAt }), landingBeat)];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [target, held]);

  return shown;
}

function levelUpSteps(target: Level, gain: Gain, setShown: (climb: Climb | ((current: Climb) => Climb)) => void) {
  return [
    window.setTimeout(() => setShown((current) => ({ ...current, xp: current.nextAt, toNext: 0, progress: 1, instant: false, gain })), landingBeat),
    window.setTimeout(() => setShown((current) => ({ ...target, xp: target.startsAt, toNext: target.nextAt - target.startsAt, progress: 0, instant: true, gain: current.gain, levelledAt: target.level })), landingBeat + fillBeat),
    window.setTimeout(() => setShown((current) => ({ ...target, instant: false, gain: current.gain, levelledAt: target.level })), landingBeat + fillBeat + 80),
  ];
}

export function useCountUp(target: number, { from = 0, ms = 900, delay = 0 }: { from?: number; ms?: number; delay?: number } = {}) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? target : from));
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(target);
      return;
    }
    let frame = 0;
    const startAt = performance.now() + delay;
    const step = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - startAt) / ms));
      setShown(Math.round(from + (target - from) * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, from, ms, delay]);
  return shown;
}

export type CoinPurse = { shown: number; gain: Gain | null };

export function useCoinPurse(coins: number, held: boolean): CoinPurse {
  const [settled, setSettled] = useState(coins);
  const [gain, setGain] = useState<Gain | null>(null);
  useEffect(() => {
    if (held || coins === settled) return;
    setGain((current) => ({ amount: coins - settled, from: settled, to: coins, serial: (current?.serial ?? 0) + 1 }));
    setSettled(coins);
  }, [coins, held, settled]);
  const shown = useCountUp(settled, { from: gain?.from ?? settled, ms: 800, delay: 250 });
  return { shown, gain };
}

export function useExpiring<T>(value: T | null, ms: number) {
  const [shown, setShown] = useState<T | null>(null);
  useEffect(() => {
    if (value === null) return;
    setShown(value);
    const timer = window.setTimeout(() => setShown(null), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return shown;
}
