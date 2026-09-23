import { useEffect, useState } from "react";
import { dayKeyFor, msUntilRollover, type Period } from "../../convex/lib/time";
import { useViewer } from "./viewer";

export type { Period };

export const DEFAULT_PERIOD: Period = "month";

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
  { value: "all", label: "All" },
];

/**
 * Today's day key in the workspace timezone. Reactive queries take it as an argument instead of reading
 * the server clock, so this hook re-renders at local midnight and every period, week rank and allowance
 * rolls over with it. It also re-checks when the tab wakes up, since timers stall while a laptop sleeps.
 */
export function useWorkspaceToday(): string {
  const timeZone = useViewer().workspace.timezone;
  const [today, setToday] = useState(() => dayKeyFor(Date.now(), timeZone));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      clearTimeout(timer);
      const now = Date.now();
      setToday(dayKeyFor(now, timeZone));
      timer = setTimeout(sync, msUntilRollover(now, timeZone) + 50);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, [timeZone]);
  return today;
}
