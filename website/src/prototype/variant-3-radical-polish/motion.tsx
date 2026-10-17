// PROTOTYPE (#625): the level bar that climbs, the coin, and count-ups for the Radical polish variant. Never merge to main.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { prefersReducedMotion } from "../../reducedMotion";
import type { Level } from "../world";

type Climb = { level: number; progress: number; animated: boolean };

const fillMs = 650;

export function useClimb({ level, progress }: Pick<Level, "level" | "progress">): Climb {
  const [shown, setShown] = useState<Climb>({ level, progress, animated: true });
  const shownLevel = useRef(level);
  useEffect(() => {
    const levelledUp = level > shownLevel.current;
    shownLevel.current = level;
    if (!levelledUp || prefersReducedMotion()) {
      setShown({ level, progress, animated: true });
      return;
    }
    setShown((current) => ({ ...current, progress: 1, animated: true }));
    const emptied = setTimeout(() => setShown({ level, progress: 0, animated: false }), fillMs);
    const refilled = setTimeout(() => setShown({ level, progress, animated: true }), fillMs + 60);
    return () => {
      clearTimeout(emptied);
      clearTimeout(refilled);
    };
  }, [level, progress]);
  return shown;
}

export function LevelBar({ level, size = "md", label }: { level: Pick<Level, "level" | "progress">; size?: "sm" | "md" | "lg"; label: string }) {
  const climb = useClimb(level);
  const style = { "--v3-fill": `${Math.round(climb.progress * 1000) / 10}%` } as CSSProperties;
  return (
    <span role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.progress * 100)} className={`v3-bar v3-bar-${size}`} data-animated={climb.animated || undefined} style={style}>
      <span className="v3-bar-fill" />
    </span>
  );
}

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

export function Coin({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" className="v3-coin">
      <circle cx="8" cy="8" r="7.25" fill="#F7A501" stroke="#B87A00" strokeWidth="1" />
      <circle cx="8" cy="8" r="4.4" fill="none" stroke="#FFE3A3" strokeWidth="1.3" />
    </svg>
  );
}
