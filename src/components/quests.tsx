import clsx from "clsx";
import type { useQuery } from "convex/react";
import { CalendarDays, Check, Hash, History, Lock, type LucideIcon, Minus, PenLine, Sparkles, UserPlus, Users } from "lucide-react";
import { Link } from "react-router";
import type { api } from "../../convex/_generated/api";
import { Locked } from "@/components/game";
import { Paper } from "@/components/room";
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
    Add a few words of <em>why</em> (3 or more).
  </>,
  <>Thanking someone back within 3 days doesn't count.</>,
  <>On the weekly board, one message counts once, however many people you mention.</>,
];

type Reward = { xp: number; coins: number };
/** "10 XP and 2 Hog coins". */
const rewardWords = (r: Reward) => [`${r.xp} XP`, r.coins ? `${r.coins} Hog ${r.coins === 1 ? "coin" : "coins"}` : null].filter(Boolean).join(" and ");

/** The paper's tick box: a hedge check when done, a dash when waived, empty while open. */
function Tick({ status, large }: { status: "done" | "waived" | "open"; large?: boolean }) {
  return (
    <span
      className={clsx(
        "pixel-chip mt-0.5 grid shrink-0 place-items-center",
        large ? "h-6 w-6" : "h-5 w-5",
        status === "done" ? "bg-hedge-deep text-cream" : status === "waived" ? "bg-parchment-deep text-ink/70" : "bg-parchment",
      )}
      {...(status === "done" ? { "data-done": true } : {})}
    >
      {status === "done" && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
      {status === "waived" && <Minus className="h-3 w-3" strokeWidth={3} aria-hidden />}
      <span className="sr-only">{status === "done" ? "Done" : status === "waived" ? "Not available" : "Open"}</span>
    </span>
  );
}

/**
 * The week's board as every web surface shows it (the cabin, the signpost): the quests, and with
 * the game on (#93, §G11) today's daily quest and what quests pay; below level 5 all of it is
 * visible but locked, with how to get there. On the signpost (`lg`) the quests are three papers
 * pinned side by side when the window is wide; in the cabin they're a compact list.
 */
export function QuestBoardBody({ board, size = "md" }: { board: QuestBoard; size?: "md" | "lg" }) {
  const large = size === "lg";
  if (board.locked) {
    return (
      <div className="space-y-3">
        <Locked title="Quests" level={board.locked.level} how={`You're level ${board.locked.current}. Thoughtful kudos get you there, then this board and a daily quest pay XP and Hog coins.`} />
        <ul className={clsx(large ? "grid grid-cols-1 gap-4 @lg:grid-cols-3" : "space-y-2")} aria-label="This week's quests, locked">
          {[...board.quests.map((q) => q.title), ...(board.daily ? [`Today: ${board.daily.title}`] : [])].map((title) => (
            <li key={title} className="flex items-center gap-2 border-2 border-dashed border-bark/30 px-3 py-2 text-sm text-ink/75">
              <Lock className="h-3.5 w-3.5 shrink-0 text-ink/70" aria-hidden />
              {title}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <ul className={clsx(large ? "grid grid-cols-1 gap-4 pt-1 @lg:grid-cols-3" : "space-y-3 pt-1")}>
        {board.quests.map((q) => (
          <QuestItem key={q.key} quest={q} size={size} />
        ))}
      </ul>
      {board.daily && <DailyQuestItem daily={board.daily} reward={board.rewards?.daily ?? null} />}
      {board.rewards && (
        <p className="text-xs text-ink/75">
          Each weekly quest pays {rewardWords(board.rewards.weekly)}. A clean sweep pays {rewardWords(board.rewards.sweep)} more.
        </p>
      )}
    </div>
  );
}

/** Today's daily quest: a small note pinned under the board. Missing it costs nothing, tomorrow brings another. */
function DailyQuestItem({ daily, reward }: { daily: NonNullable<QuestBoard["daily"]>; reward: Reward | null }) {
  const done = daily.status === "done";
  return (
    <Paper data-daily-quest pin="bg-ember" tone={done ? "done" : undefined} className="max-w-md">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <span className="text-xs font-semibold text-soil">Today's quest</span>
        {reward && <span className="text-[11px] text-ink/75">Pays {rewardWords(reward)}</span>}
      </div>
      <div className="mt-1.5 flex items-start gap-3">
        <Tick status={done ? "done" : "open"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">{daily.title}</span>
            <span className="shrink-0 text-xs text-ink/75 tabular">
              {daily.progress} of {daily.goal}
            </span>
          </div>
          <p className="text-xs text-ink/75">{daily.description}</p>
          <p className="mt-1 text-[11px] text-ink/70">{done && daily.completedAt ? `Completed ${relativeTime(daily.completedAt)}` : "A new one tomorrow. Missing it costs nothing."}</p>
        </div>
      </div>
    </Paper>
  );
}

/** A quest on this week's board, one paper: progress while open, its Quest message once done, faded when waived. */
export function QuestItem({ quest: q, size = "md" }: { quest: QuestRow; size?: "md" | "lg" }) {
  const done = q.status === "done";
  const waived = q.status === "waived";
  const large = size === "lg";
  const why = waived ? waivedCopy(q.key, q.waivedReason) : null;
  return (
    <li data-quest-paper className="min-w-0">
      <Paper tone={done ? "done" : waived ? "faded" : undefined} pin={done ? "bg-hedge" : "bg-lantern"} className="h-full">
        <div className="flex items-start gap-3">
          <Tick status={done ? "done" : waived ? "waived" : "open"} large={large} />
          <div className="min-w-0 flex-1">
            <h4 className={clsx("font-semibold", large ? "text-base" : "text-sm")}>{q.title}</h4>
            <p className={clsx("text-ink/75", large ? "text-sm" : "text-xs")}>{q.description}</p>
          </div>
        </div>
        {waived && <p className="mt-2 text-xs text-ink/70">Not available this week{why ? `: ${why}` : ""}.</p>}
        {q.status === "active" && (
          <div className="mt-3">
            <Progress value={q.progress} max={q.goal} height={large ? 10 : 8} />
            <div className="mt-1 text-xs text-ink/75 tabular">
              {q.progress} of {q.goal}
            </div>
          </div>
        )}
        {done && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink/70">
            {q.messageRarity && (
              <Link to="/discoveries?category=quest_complete" title="See your Quest messages in the gallery">
                <RarityBadge rarity={q.messageRarity} size="xs" />
              </Link>
            )}
            {q.completedAt ? <span>Completed {relativeTime(q.completedAt)}</span> : <span>Done</span>}
          </div>
        )}
      </Paper>
    </li>
  );
}
