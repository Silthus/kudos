import clsx from "clsx";
import type { useQuery } from "convex/react";
import { CalendarDays, Check, Hash, History, Lock, type LucideIcon, Minus, PenLine, Sparkles, UserPlus, Users } from "lucide-react";
import { Link } from "react-router";
import type { api } from "../../convex/_generated/api";
import { Locked } from "@/components/game";
import { Progress, RarityBadge } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { waivedCopy } from "@/lib/quests";

export type QuestBoard = Extract<NonNullable<ReturnType<typeof useQuery<typeof api.quests.mine>>>, { enabled: true }>;
type QuestRow = QuestBoard["quests"][number];

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

/** What makes a kudos count towards quests, in the member's words. */
export const QUEST_RULES = [
  <>
    Add a few words of <em>why</em> (3+ words).
  </>,
  <>Thanking someone back within 3 days doesn't count.</>,
  <>On the weekly board, one message counts once, however many people you mention.</>,
];

type Reward = { xp: number; coins: number };
const rewardLabel = (r: Reward) => [`+${r.xp} XP`, r.coins ? `+${r.coins} Hog ${r.coins === 1 ? "coin" : "coins"}` : null].filter(Boolean).join(" · ");

/**
 * The week's board as every web surface shows it (Me card, quest log): the quests, and with the
 * game on (#93, §G11) today's daily quest and what quests pay; below level 5 all of it is visible
 * but locked, with how to get there.
 */
export function QuestBoardBody({ board, size = "md" }: { board: QuestBoard; size?: "md" | "lg" }) {
  if (board.locked) {
    return (
      <div className="space-y-3">
        <Locked title="Quests" level={board.locked.level} how={`You're level ${board.locked.current}. Thoughtful kudos get you there; then this board and a daily quest pay XP and Hog coins.`} />
        <ul className="space-y-1.5" aria-label="This week's quests, locked">
          {[...board.quests.map((q) => q.title), ...(board.daily ? [`Today: ${board.daily.title}`] : [])].map((title) => (
            <li key={title} className="flex items-center gap-2 border border-dashed border-parchment-deep px-3 py-2 text-sm text-ink/75">
              <Lock className="h-3.5 w-3.5 shrink-0 text-ink/65" aria-hidden />
              {title}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <ul className={clsx(size === "lg" ? "space-y-3" : "space-y-2")}>
        {board.quests.map((q) => (
          <QuestItem key={q.key} quest={q} size={size} />
        ))}
      </ul>
      {board.daily && <DailyQuestItem daily={board.daily} reward={board.rewards?.daily ?? null} />}
      {board.rewards && (
        <p className="text-xs text-ink/65">
          Each weekly quest {rewardLabel(board.rewards.weekly)} · clean sweep +{board.rewards.sweep.xp} XP
        </p>
      )}
    </div>
  );
}

/** Today's daily quest: one small goal; missing it costs nothing, tomorrow brings another. */
function DailyQuestItem({ daily, reward }: { daily: NonNullable<QuestBoard["daily"]>; reward: Reward | null }) {
  const done = daily.status === "done";
  return (
    <div data-daily-quest className={clsx("border p-3.5", done ? "border-hedge/25 bg-hedge/[0.06]" : "border-lantern/30 bg-lantern/[0.04]")}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-soil">Today's quest</span>
        {reward && <span className="text-[11px] text-ink/75 tabular">{rewardLabel(reward)}</span>}
      </div>
      <div className="mt-1.5 flex items-start gap-3">
        <span className={clsx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center", done ? "bg-hedge text-ink" : "border border-bark/60")} {...(done ? { "data-done": true } : {})}>
          {done && <Check className="h-3 w-3" strokeWidth={3} />}
          <span className="sr-only">{done ? "Done" : "Open"}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{daily.title}</span>
            <span className="text-xs text-ink/75 tabular">
              {daily.progress}/{daily.goal}
            </span>
          </div>
          <p className="text-xs text-ink/75">{daily.description}</p>
          {done && daily.completedAt ? (
            <p className="mt-1 text-[11px] text-ink/65">Completed {relativeTime(daily.completedAt)}</p>
          ) : (
            <p className="mt-1 text-[11px] text-ink/65">A new one tomorrow; missing it costs nothing.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** A quest on this week's board: progress while open, its Quest message once done, muted when waived. */
export function QuestItem({ quest: q, size = "md" }: { quest: QuestRow; size?: "md" | "lg" }) {
  const done = q.status === "done";
  const waived = q.status === "waived";
  const large = size === "lg";
  return (
    <li
      className={clsx(
        "border transition-colors",
        large ? "p-4" : "p-3.5",
        done ? "border-hedge/25 bg-hedge/[0.06]" : waived ? "border-dashed border-parchment-deep bg-transparent" : "border-parchment-deep bg-parchment-deep/40",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={clsx(
            "mt-0.5 grid shrink-0 place-items-center",
            large ? "h-6 w-6" : "h-5 w-5",
            done ? "bg-hedge text-ink" : waived ? "bg-parchment-deep text-ink/65" : "border border-bark/60",
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
              <span className="text-xs text-ink/75 tabular">
                {q.progress}/{q.goal}
              </span>
            )}
          </div>
          <p className={clsx("text-ink/75", large ? "text-sm" : "text-xs")}>{q.description}</p>
          {waived && <p className="mt-1 text-xs text-ink/65">Not available this week · {waivedCopy(q.key, q.waivedReason)}</p>}
          {q.status === "active" && <Progress value={q.progress} max={q.goal} className="mt-2" height={large ? 6 : 4} />}
          {done && (q.completedAt || q.messageRarity) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink/65">
              {q.messageRarity && (
                <Link to="/discoveries?category=quest_complete" title="See your Quest messages in the gallery" className="transition hover:opacity-80">
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
