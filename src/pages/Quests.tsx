import clsx from "clsx";
import { useQuery } from "convex/react";
import { Check, Minus, ScrollText, Target } from "lucide-react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { QUEST_ICON, QUEST_RULES, QuestItem, waivedCopy, type QuestBoard, type WaivedReason } from "@/components/quests";
import { BigNumber, Card, CardHeader, Empty, PageHeader, PageSkeleton } from "@/components/ui";
import { dayLabel, rangeLabel } from "@/lib/format";
import { useWorkspaceToday } from "@/lib/period";

type QuestLog = NonNullable<ReturnType<typeof useQuery<typeof api.quests.history>>>;

/** The member's private quest log: this week's board, lifetime totals and a stamp per quest of the past weeks. */
export function Quests() {
  const today = useWorkspaceToday();
  const board = useQuery(api.quests.mine, { today });
  const log = useQuery(api.quests.history, { today });
  if (board === undefined || log === undefined) return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        eyebrow="Only you can see this page"
        title="Quest log"
        subtitle="Weekly goals for thoughtful, spread-out recognition. They only count what you give, never what you receive, and nobody else sees how you're doing."
      />
      {!board.enabled ? (
        <Card>
          <Empty icon={<Target className="h-7 w-7 text-faint" />} title="Quests are off in this workspace">
            An admin can turn weekly quests on in the settings. Your log is kept.
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <ThisWeek board={board} />
          <div className="flex flex-col gap-4 xl:col-span-5">
            <Lifetime totals={log.totals} />
            <HowQuestsCount />
          </div>
        </div>
      )}
      <PastWeeks weeks={log.weeks} />
    </div>
  );
}

function ThisWeek({ board }: { board: QuestBoard }) {
  return (
    <Card className="xl:col-span-7 xl:self-start">
      <CardHeader
        title="This week"
        subtitle={`${rangeLabel(board.weekStart, board.weekEnd)} · ${
          board.available > 0 ? `${board.completed} of ${board.available} complete` : "nothing to do this week"
        } · resets Monday`}
        icon={<Target className="h-4 w-4 text-saffron" />}
        action={board.sweep && <SweepPill />}
      />
      <ul className="space-y-3 px-5 pb-5">
        {board.quests.map((q) => (
          <QuestItem key={q.key} quest={q} size="lg" />
        ))}
      </ul>
    </Card>
  );
}

function SweepPill({ compact }: { compact?: boolean }) {
  return (
    <span className="whitespace-nowrap rounded-full bg-up/15 px-2.5 py-1 text-xs font-medium text-up" title="Clean sweep: every quest that week">
      {compact ? (
        <>
          <span className="hidden sm:inline">Clean sweep </span>🧹<span className="sr-only sm:hidden">Clean sweep</span>
        </>
      ) : (
        "Clean sweep 🧹"
      )}
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
    <Card>
      <CardHeader title="Lifetime" subtitle="Everything you've completed so far" />
      <dl className="grid grid-cols-3 gap-2 px-5 pb-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-ink/40 p-3">
            <dd>
              <BigNumber value={s.value} className="text-3xl" />
            </dd>
            <dt className="mt-1 text-xs leading-snug text-muted">{s.label}</dt>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function HowQuestsCount() {
  return (
    <Card>
      <CardHeader title="How quests count" />
      <ul className="list-disc space-y-1.5 px-5 pb-5 pl-10 text-sm leading-relaxed text-muted marker:text-faint">
        {QUEST_RULES.map((rule, i) => (
          <li key={i}>{rule}</li>
        ))}
        <li>Only the kudos you give count, never the ones you receive.</li>
        <li>Unfinished quests simply expire on Monday: no streaks to keep, nothing to lose.</li>
        <li>
          Every completed quest earns a collectible{" "}
          <Link to="/discoveries?category=quest_complete" className="font-medium text-saffron underline-offset-4 hover:underline">
            Quest message
          </Link>
          , Rare or better for a clean sweep.
        </li>
      </ul>
    </Card>
  );
}

type PastQuest = QuestLog["weeks"][number]["board"][number];

function stampLabel(q: PastQuest) {
  if (q.done) return `${q.title}: completed${q.completedAt ? ` ${new Date(q.completedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}` : ""}`;
  if (q.waived) return `${q.title}: not available (${waivedCopy(q.key, q.waived as WaivedReason)})`;
  return `${q.title}: not completed`;
}

/** One stamp: filled when done, outlined when not, dimmed when it wasn't available. Titles show from `sm` up. */
function Stamp({ quest: q }: { quest: PastQuest }) {
  const Icon = QUEST_ICON[q.key] ?? Target;
  return (
    <li
      title={stampLabel(q)}
      className={clsx(
        "flex h-9 items-center justify-center gap-1.5 rounded-full border text-xs font-medium sm:justify-start sm:px-3",
        "w-9 sm:w-auto",
        q.done && "border-up/40 bg-up/15 text-up",
        !q.done && !q.waived && "border-line-strong text-muted",
        q.waived && "border-dashed border-line-strong text-faint opacity-60",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="hidden truncate sm:inline">{q.title}</span>
      {q.done && <Check className="hidden h-3.5 w-3.5 shrink-0 sm:inline" strokeWidth={3} aria-hidden />}
      {q.waived && <Minus className="hidden h-3.5 w-3.5 shrink-0 sm:inline" strokeWidth={3} aria-hidden />}
      <span className="sr-only">{stampLabel(q)}</span>
    </li>
  );
}

function PastWeeks({ weeks }: { weeks: QuestLog["weeks"] }) {
  return (
    <Card className="mt-4">
      <CardHeader
        title="Past weeks"
        subtitle="A stamp for every quest you completed; open ones just expired."
        icon={<ScrollText className="h-4 w-4 text-saffron" />}
        action={<Legend />}
      />
      {weeks.length === 0 ? (
        <Empty icon={<ScrollText className="h-7 w-7 text-faint" />} title="Your log starts next week">
          Each Monday, last week's board lands here with a stamp for every quest you completed.
        </Empty>
      ) : (
        <ol className="divide-y divide-line px-5 pb-3">
          {weeks.map((w) => (
            <li key={w.weekKey} className="flex items-center gap-3 py-2.5 sm:gap-4">
              <div className="w-16 shrink-0 sm:w-28">
                <div className="text-sm font-medium tabular">{dayLabel(w.weekKey)}</div>
                <div className="hidden text-xs text-faint sm:block">
                  {w.board.filter((q) => q.done).length} of {w.board.filter((q) => q.done || !q.waived).length} done
                </div>
              </div>
              <ul className="flex min-w-0 flex-1 flex-wrap gap-2" aria-label={`Week of ${dayLabel(w.weekKey, { month: "long", day: "numeric" })}`}>
                {w.board.map((q) => (
                  <Stamp key={q.key} quest={q} />
                ))}
              </ul>
              {w.sweep && <SweepPill compact />}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function Legend() {
  const items = [
    { label: "Completed", cls: "border-up/40 bg-up/15" },
    { label: "Not completed", cls: "border-line-strong" },
    { label: "Not available", cls: "border-dashed border-line-strong opacity-60" },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={clsx("h-3 w-3 rounded-full border", i.cls)} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
