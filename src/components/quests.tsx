import clsx from "clsx";
import type { useQuery } from "convex/react";
import { CalendarDays, Check, Hash, History, type LucideIcon, Minus, PenLine, Sparkles, UserPlus, Users } from "lucide-react";
import { Link } from "react-router";
import type { api } from "../../convex/_generated/api";
import { Progress, RarityBadge } from "@/components/ui";
import { relativeTime } from "@/lib/format";

export type QuestBoard = Extract<NonNullable<ReturnType<typeof useQuery<typeof api.quests.mine>>>, { enabled: true }>;
type QuestRow = QuestBoard["quests"][number];
export type WaivedReason = QuestRow["waivedReason"];

/** One mark per quest, for the quest log's stamps. */
export const QUEST_ICON: Record<string, LucideIcon> = {
  spread: Users,
  fresh: UserPlus,
  rekindle: History,
  unsung: Sparkles,
  steady: CalendarDays,
  channels: Hash,
  story: PenLine,
};

export function waivedCopy(key: string, reason: WaivedReason) {
  switch (reason) {
    case "privacy":
      return "hidden by your workspace's privacy settings";
    case "too_new":
      return "needs more history";
    case "no_candidates":
      return key === "spread" ? "needs at least 3 teammates" : "you've already recognized everyone 🎉";
    default:
      return null;
  }
}

/** What makes a kudos count towards quests, in the member's words. */
export const QUEST_RULES = [
  <>
    Add a few words of <em>why</em> (3+ words).
  </>,
  <>Thanking someone back within 3 days doesn't count.</>,
  <>One message counts once, however many people you mention.</>,
];

/** A quest on this week's board: progress while open, its Quest message once done, muted when waived. */
export function QuestItem({ quest: q, size = "md" }: { quest: QuestRow; size?: "md" | "lg" }) {
  const done = q.status === "done";
  const waived = q.status === "waived";
  const large = size === "lg";
  return (
    <li
      className={clsx(
        "rounded-xl border transition-colors",
        large ? "p-4" : "p-3.5",
        done ? "border-up/25 bg-up/[0.06]" : waived ? "border-dashed border-line bg-transparent" : "border-line bg-ink/40",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={clsx(
            "mt-0.5 grid shrink-0 place-items-center rounded-full",
            large ? "h-6 w-6" : "h-5 w-5",
            done ? "bg-up text-ink" : waived ? "bg-panel-3 text-faint" : "border border-line-strong",
          )}
        >
          {done && <Check className="h-3 w-3" strokeWidth={3} />}
          {waived && <Minus className="h-3 w-3" strokeWidth={3} />}
          <span className="sr-only">{done ? "Done" : waived ? "Not available" : "Open"}</span>
        </span>
        <div className={clsx("min-w-0 flex-1", waived && "opacity-60")}>
          <div className="flex items-center justify-between gap-3">
            <span className={clsx("font-medium", large ? "text-base" : "text-sm")}>{q.title}</span>
            {!waived && (
              <span className="font-mono text-xs text-muted tabular">
                {q.progress}/{q.goal}
              </span>
            )}
          </div>
          <p className={clsx("text-muted", large ? "text-sm" : "text-xs")}>{q.description}</p>
          {waived && <p className="mt-1 text-xs text-faint">Not available this week · {waivedCopy(q.key, q.waivedReason)}</p>}
          {q.status === "active" && <Progress value={q.progress} max={q.goal} className="mt-2" height={large ? 6 : 4} />}
          {done && (q.completedAt || q.messageRarity) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-faint">
              {q.messageRarity && (
                <Link to="/discoveries?category=quest_complete" title="See your Quest messages in the gallery" className="rounded-full transition hover:opacity-80">
                  <RarityBadge rarity={q.messageRarity} size="xs" />
                </Link>
              )}
              {q.completedAt && <span>Completed {relativeTime(q.completedAt)}</span>}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
