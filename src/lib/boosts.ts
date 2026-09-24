import type { BoostSource } from "../../convex/lib/boosts";

type Announcement = { status: "pending" | "sent" | "skipped" | "failed"; channel?: string; error?: string };

/** How a boost's announcement went, as the admin page says it (#97, §G13/G14). */
export function announcementStatus(a: Announcement | null, isDemo: boolean): { tone: "ok" | "error" | "muted"; text: string } {
  const where = a?.channel ? `#${a.channel}` : "the channel";
  switch (a?.status) {
    case "sent":
      return { tone: "ok", text: `Posted in ${where}` };
    case "pending":
      return { tone: "muted", text: `Posting in ${where}…` };
    case "failed":
      return a.error === "not_in_channel"
        ? { tone: "error", text: `Not posted: the Kudos app isn't in ${where}. Invite it there with /invite @Kudos; the boost runs anyway.` }
        : { tone: "error", text: `Not posted in ${where} (${a.error ?? "unknown error"}). The boost runs anyway.` };
    default:
      return isDemo
        ? { tone: "muted", text: "Preview: the demo has no Slack, so nothing is posted" }
        : { tone: "muted", text: "Banner only: no announcement channel was set" };
  }
}

/** Who or what started a boost. */
export function startedBy(source: BoostSource, by: string | null): string {
  switch (source) {
    case "schedule":
      return `Scheduled by ${by ?? "a former admin"}`;
    case "booster":
      return `Booster bought by ${by ?? "a former member"}`;
    case "team_garden":
      return "A team garden milestone";
    case "capstone":
      return `Called by ${by ?? "a former member"} (Block party)`;
  }
}
