import { workspaceNow } from "../../convex/lib/time";

export const nf = new Intl.NumberFormat("en-US");

export function pct(n: number, digits = 0) {
  return `${(n * 100).toFixed(digits)}%`;
}

export function delta(cur: number, prev: number | null | undefined) {
  if (prev === null || prev === undefined) return null;
  if (prev === 0) return cur > 0 ? { pct: null, diff: cur } : { pct: 0, diff: 0 };
  return { pct: (cur - prev) / prev, diff: cur - prev };
}

export function dayLabel(dayKey: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export function rangeLabel(start: string, end: string) {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${dayLabel(start, sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" })} – ${dayLabel(end, { month: "short", day: "numeric", year: "numeric" })}`;
}

/**
 * The workspace clock (#143, convex/lib/time.ts `workspaceNow`): a simulator's runs ahead of the wall
 * clock by its `clockOffsetMs`; every other workspace's offset is 0. The world shell sets it from
 * the viewer, so times on the page ("2h ago", the sandbox's clock) read on the workspace's clock.
 */
let clockOffsetMs = 0;

export function setWorkspaceClock(offsetMs: number) {
  clockOffsetMs = offsetMs;
}

/** Now, on the shown workspace's clock. */
export function workspaceClockNow() {
  return workspaceNow({ clockOffsetMs });
}

export function relativeTime(ts: number, now = workspaceClockNow()) {
  const s = Math.round((now - ts) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function firstName(name: string) {
  return name.split(" ")[0];
}
