import { useEffect, useState } from "react";
import { workspaceClockNow } from "@/lib/format";

/** The world's clock for presence queries, rounded down to this, so they're asked again only this often. */
const NOW_STEP_MS = 5_000;

/**
 * The workspace clock (a simulator's runs ahead, #143), rounded down to 5 s and moving on every
 * 5 s while `on`: presence queries take it as `now` (they can't read the clock themselves).
 */
export function useWorldNow(on: boolean): number {
  const round = () => Math.floor(workspaceClockNow() / NOW_STEP_MS) * NOW_STEP_MS;
  const [now, setNow] = useState(round);
  useEffect(() => {
    if (!on) return;
    setNow(round());
    const timer = setInterval(() => setNow(round()), NOW_STEP_MS);
    return () => clearInterval(timer);
  }, [on]);
  return now;
}
