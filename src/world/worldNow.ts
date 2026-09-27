import { useEffect, useState } from "react";
import { workspaceClockNow } from "@/lib/format";

/** The world's clock for presence queries, rounded down to this, so they're asked again only this often. */
const NOW_STEP_MS = 5_000;

/**
 * The workspace clock (a simulator's runs ahead, #143), rounded down to `step` (5 s) and moving on
 * every `step` while `on`: presence queries take it as `now` (they can't read the clock themselves),
 * and a countdown ticks with a step of a second.
 */
export function useWorldNow(on: boolean, step = NOW_STEP_MS): number {
  const round = () => Math.floor(workspaceClockNow() / step) * step;
  const [now, setNow] = useState(round);
  useEffect(() => {
    if (!on) return;
    setNow(round());
    const timer = setInterval(() => setNow(round()), step);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, step]);
  return now;
}

/** Whole seconds from `now` (rounded down to the second, so one more is still to come) until `until`, never below zero. */
export const secondsLeft = (until: number, now: number) => Math.max(0, Math.floor((until - now) / 1000));
