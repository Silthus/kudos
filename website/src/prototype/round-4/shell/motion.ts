// PROTOTYPE (#625, round 4): reduced motion, the XP held back during an opening, a count-up and small text helpers. Never merge to main.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

function mediaHook(query: string) {
  const subscribe = (onChange: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  };
  return () => useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

export const usePrefersReducedMotion = mediaHook("(prefers-reduced-motion: reduce)");

let heldXp: number | null = null;

const heldXpWatchers = new Set<() => void>();

function tellHeldXpWatchers() {
  for (const watcher of heldXpWatchers) watcher();
}

export function holdXpAt(xp: number) {
  heldXp = xp;
  tellHeldXpWatchers();
}

export function releaseXp() {
  if (heldXp === null) return;
  heldXp = null;
  tellHeldXpWatchers();
}

function watchHeldXp(onChange: () => void) {
  heldXpWatchers.add(onChange);
  return () => heldXpWatchers.delete(onChange);
}

export function useHeldXp() {
  return useSyncExternalStore(watchHeldXp, () => heldXp);
}

const easeOut = (share: number) => 1 - (1 - share) ** 3;

export function useCountUp(target: number, durationMs = 900) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (reduced || from === target) {
      current.current = target;
      setShown(target);
      return;
    }
    const startedAt = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const share = Math.min(1, (now - startedAt) / durationMs);
      current.current = from + (target - from) * easeOut(share);
      setShown(current.current);
      if (share < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced, durationMs]);
  return shown;
}

export function useGain(value: number, showForMs = 2200) {
  const [gain, setGain] = useState<{ amount: number; key: number } | null>(null);
  const before = useRef(value);
  useEffect(() => {
    const amount = value - before.current;
    before.current = value;
    if (amount <= 0) return;
    setGain({ amount, key: performance.now() });
    const timer = window.setTimeout(() => setGain(null), showForMs);
    return () => window.clearTimeout(timer);
  }, [value, showForMs]);
  return gain;
}

export function firstNameOf(name: string) {
  return name.split(" ")[0] ?? name;
}

export function clipped(text: string, length: number) {
  return text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`;
}
