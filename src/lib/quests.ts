import { dayLabel } from "./format";

export type WaivedReason = "no_candidates" | "privacy" | "too_new" | null;

/** Why a quest isn't available, in the member's words. */
export function waivedCopy(key: string, reason: WaivedReason) {
  switch (reason) {
    case "privacy":
      return "hidden by your workspace's privacy settings";
    case "too_new":
      return "needs more history";
    case "no_candidates":
      return key === "spread" ? "needs at least 3 teammates" : "you've already recognized everyone";
    default:
      return null;
  }
}

/** A quest week by its Monday; the year only when it isn't the current one. */
export function weekLabel(weekKey: string, today: string) {
  const sameYear = weekKey.slice(0, 4) === today.slice(0, 4);
  return dayLabel(weekKey, sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

/** What happened to a quest in a past week, dated on the workspace's calendar. */
export function stampLabel(
  q: { title: string; key: string; done: boolean; completedAt: number | null; waived: WaivedReason },
  timeZone: string,
) {
  if (q.done) {
    const on = q.completedAt && new Date(q.completedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone });
    return `${q.title}: completed${on ? ` ${on}` : ""}`;
  }
  if (q.waived) return `${q.title}: not available (${waivedCopy(q.key, q.waived)})`;
  return `${q.title}: not completed`;
}
