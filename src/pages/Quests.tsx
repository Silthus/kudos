import clsx from "clsx";
import { useQuery } from "convex/react";
import { Check, Minus, Target } from "lucide-react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { QUEST_ICON, QUEST_RULES, QuestBoardBody, type QuestBoard } from "@/components/quests";
import { Room } from "@/components/room";
import { BigNumber, Empty, PageSkeleton } from "@/components/ui";
import { dayLabel, rangeLabel } from "@/lib/format";
import { useWorkspaceToday } from "@/lib/period";
import { stampLabel, weekLabel } from "@/lib/quests";
import { useViewer } from "@/lib/viewer";

type QuestLog = NonNullable<ReturnType<typeof useQuery<typeof api.quests.history>>>;

const linkCls = "font-semibold text-ember-deep underline decoration-2 underline-offset-4";

/**
 * The quest signpost (#126, #130), the member's private quest log: this week's quests pinned to
 * the post as papers, today's quest as a small note, lifetime totals, how quests count, and a row
 * of stamps for every past week. It lays out by the window's width.
 */
export function Quests() {
  const today = useWorkspaceToday();
  const board = useQuery(api.quests.mine, { today });
  const log = useQuery(api.quests.history, { today });
  if (board === undefined || log === undefined) return <PageSkeleton />;

  return (
    <div className="space-y-8">
      <p className="text-[15px] leading-6 text-ink/75">
        Only you see this signpost. Weekly goals for thoughtful, spread-out recognition: they count the kudos you give, never the ones you receive, and nobody else sees how you're doing.
      </p>
      {!board.enabled ? (
        <div className="pixel-note px-4 py-3">
          {board.hidden ? (
            <>
              <p className="font-display text-lg font-medium">Quests are part of the game you've hidden</p>
              <p className="mt-1 text-sm text-ink/75">They still count and pay while it's hidden. Show the game again with the switch by your cabin door.</p>
              <Link to="/me" className={clsx(linkCls, "mt-2 inline-block text-sm")}>
                Go to your cabin
              </Link>
            </>
          ) : (
            <>
              <p className="font-display text-lg font-medium">Quests are off in this workspace</p>
              <p className="mt-1 text-sm text-ink/75">An admin can turn weekly quests on in the settings. Your log is kept.</p>
            </>
          )}
        </div>
      ) : (
        <>
          <ThisWeek board={board} />
          <div className="grid grid-cols-1 gap-8 @lg:grid-cols-2">
            <Lifetime totals={log.totals} />
            <HowQuestsCount />
          </div>
        </>
      )}
      <PastWeeks weeks={log.weeks} today={today} />
    </div>
  );
}

function ThisWeek({ board }: { board: QuestBoard }) {
  const status = board.locked
    ? `opens at level ${board.locked.level}`
    : board.available > 0
      ? `${board.completed} of ${board.available} done`
      : "nothing to do this week";
  return (
    <Room title="This week" subtitle={`${rangeLabel(board.weekStart, board.weekEnd)}, ${status}. A new board on Monday.`} action={board.sweep && <SweepChip />}>
      <QuestBoardBody board={board} size="lg" />
    </Room>
  );
}

function SweepChip() {
  return (
    <span className="pixel-chip inline-block whitespace-nowrap bg-hedge-deep px-2 py-0.5 text-xs font-semibold text-cream" title="Clean sweep: every quest that week">
      Clean sweep
    </span>
  );
}

function Lifetime({ totals }: { totals: QuestLog["totals"] }) {
  const stats = [
    { label: "Quests completed", value: totals.completed },
    { label: "Clean sweeps", value: totals.sweeps },
    { label: "Weeks with a quest done", value: totals.weeksWithCompletion },
  ];
  return (
    <Room title="Lifetime" subtitle="Everything you've completed so far">
      <dl className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="pixel-chip min-w-0 bg-parchment-deep/40 p-3">
            <dd>
              <BigNumber value={s.value} className="text-3xl" />
            </dd>
            <dt className="mt-1 text-xs leading-snug text-ink/75">{s.label}</dt>
          </div>
        ))}
      </dl>
    </Room>
  );
}

function HowQuestsCount() {
  return (
    <Room title="How quests count">
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink/75 marker:text-ink/70">
        {QUEST_RULES.map((rule, i) => (
          <li key={i}>{rule}</li>
        ))}
        <li>Only the kudos you give count, never the ones you receive.</li>
        <li>Unfinished quests simply expire on Monday: no streaks to keep, nothing to lose.</li>
        <li>
          Every completed weekly quest earns a collectible{" "}
          <Link to="/discoveries?category=quest_complete" className={linkCls}>
            Quest message
          </Link>
          , Rare or better for a clean sweep.
        </li>
      </ul>
    </Room>
  );
}

type PastQuest = QuestLog["weeks"][number]["board"][number];

/** One pixel stamp: inked in hedge when done, an empty outline when not, a faded dashed one when it wasn't available. Titles show on wide windows. */
function Stamp({ quest: q, timeZone }: { quest: PastQuest; timeZone: string }) {
  const Icon = QUEST_ICON[q.key] ?? Target;
  const label = stampLabel(q, timeZone);
  const kind = q.done ? "done" : q.waived ? "waived" : "open";
  return (
    <li
      data-stamp={kind}
      title={label}
      className={clsx(
        "relative flex h-9 min-w-9 items-center justify-center gap-1.5 text-xs font-semibold @md:justify-start @md:px-2.5",
        kind === "done" && "pixel-chip bg-hedge-deep text-cream",
        kind === "open" && "border-2 border-bark/50 text-ink/75",
        kind === "waived" && "border-2 border-dashed border-bark/40 text-ink/70 opacity-60",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="hidden truncate @md:inline" aria-hidden>
        {q.title}
      </span>
      {q.done && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />}
      {q.waived && <Minus className="hidden h-3.5 w-3.5 shrink-0 @md:inline" strokeWidth={3} aria-hidden />}
      <span className="sr-only">{label}</span>
    </li>
  );
}

function PastWeeks({ weeks, today }: { weeks: QuestLog["weeks"]; today: string }) {
  const { timezone } = useViewer().workspace;
  return (
    <Room title="Past weeks" subtitle="A stamp for every quest you completed. Open ones just expired." action={<StampLegend />}>
      {weeks.length === 0 ? (
        <Empty title="Nothing in your log yet">The Monday after a week you gave kudos in, that week's board lands here with a stamp for every quest you completed.</Empty>
      ) : (
        <ol>
          {weeks.map((w) => (
            <li key={w.weekKey} className="flex items-center gap-3 border-t border-parchment-deep py-2.5 first:border-t-0 @md:gap-4">
              <div className="w-16 shrink-0 @md:w-28">
                <div className="text-sm font-semibold tabular">{weekLabel(w.weekKey, today)}</div>
                <div className="hidden text-xs text-ink/70 @md:block">
                  {w.board.filter((q) => q.done).length} of {w.board.filter((q) => q.done || !q.waived).length} done
                </div>
              </div>
              <ul className="flex min-w-0 flex-1 flex-wrap gap-2" aria-label={`Week of ${dayLabel(w.weekKey, { month: "long", day: "numeric", year: "numeric" })}`}>
                {w.board.map((q) => (
                  <Stamp key={q.key} quest={q} timeZone={timezone} />
                ))}
              </ul>
              {w.sweep && <SweepChip />}
            </li>
          ))}
        </ol>
      )}
    </Room>
  );
}

function StampLegend() {
  const items = [
    { label: "Completed", cls: "pixel-chip bg-hedge-deep" },
    { label: "Not completed", cls: "border-2 border-bark/50" },
    { label: "Not available", cls: "border-2 border-dashed border-bark/40 opacity-60" },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/75">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={clsx("h-3 w-3", i.cls)} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
