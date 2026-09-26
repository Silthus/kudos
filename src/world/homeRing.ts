import { createContext, useContext, useEffect, useState } from "react";
import { workspaceClockNow } from "@/lib/format";
import type { Tile } from "./iso";

/**
 * The homes ring as this world draws it (#160): its plots, numbered as the server numbers them, with
 * a gap (null) where a district stands, and the world's seed. The world provides it (WorldShell), so
 * the homes' windows pick and show plots exactly where the map has them.
 */
export type HomeRing = { plots: (Tile | null)[]; seed: number };

export const HomeRingContext = createContext<HomeRing>({ plots: [], seed: 0 });

export const useHomeRing = () => useContext(HomeRingContext);

/** How often the homes' reads move on: a home's days count down a few times an hour. */
export const HOMES_CLOCK_STEP_MS = 10 * 60 * 1000;

/**
 * Now on the workspace clock, rounded down to `stepMs`: the `now` the homes' queries take, so their
 * subscriptions change every step and a stage's days count down while a window stays open.
 */
export function useClockNow(stepMs = HOMES_CLOCK_STEP_MS): number {
  const round = () => Math.floor(workspaceClockNow() / stepMs) * stepMs;
  const [now, setNow] = useState(round);
  useEffect(() => {
    const timer = setInterval(() => setNow(round()), Math.min(stepMs, 60_000));
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepMs]);
  return now;
}
