// PROTOTYPE leaderboard: three boards and three periods of kudos given, rendered from the backend's windowed rows.
import { useState, type ReactNode } from "react";
import { boards, me } from "../data/mock";
import type { BoardRow, GroupRow, Period } from "../data/types";
import { Arrow, Avatar, Hand, Hog, Pill } from "../ui";

type BoardId = "groups" | "myGroup" | "everyone";
type PersonRow = Extract<BoardRow, { kind: "row" }>;
type TeamRow = Extract<GroupRow, { kind: "row" }>;

const periods: Array<{ id: Period; label: string }> = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

const boardTabs: Array<{ id: BoardId; label: string; sub: string }> = [
  { id: "groups", label: "Groups", sub: "per person" },
  { id: "myGroup", label: "My group", sub: me.primaryGroup.name },
  { id: "everyone", label: "Everyone", sub: "all members" },
];

const medal = (rank: number) => (rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : `${rank}.`);
const isTied = <R extends { kind: string; rank?: number }>(rows: R[], rank: number) => rows.filter((r) => r.kind === "row" && r.rank === rank).length > 1;
const perPerson = (score: number) => score.toFixed(1);

export function Leaderboard(_props: { param?: string }) {
  const [board, setBoard] = useState<BoardId>("everyone");
  const [period, setPeriod] = useState<Period>("week");
  const [showMe, setShowMe] = useState(me.privacy.showOnLeaderboards);
  const facts = boards[period];

  return (
    <div className="space-y-6">
      <Heading />
      <div className="space-y-3">
        <Segmented value={board} onChange={setBoard} options={boardTabs} big />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented value={period} onChange={setPeriod} options={periods} />
          <PrivacyToggle on={showMe} onChange={setShowMe} />
        </div>
      </div>

      <section className="rounded-lg border border-line bg-surface shadow-ph">
        {board === "groups" ? (
          <GroupsBoard rows={facts.groups.rows} />
        ) : (
          <PeopleBoard rows={board === "myGroup" ? facts.myGroup.rows : facts.everyone.rows} hidden={!showMe} />
        )}
      </section>

      {board === "groups" && <GroupLines myGroupLine={facts.groups.myGroupLine} mostImproved={facts.groups.mostImproved} />}
      {board === "everyone" && <PrivateLines lines={[facts.everyone.improvementLine, facts.everyone.peerLine]} />}

      <Footnote />
    </div>
  );
}

function Heading() {
  return (
    <header className="relative">
      <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Leaderboard</h1>
      <p className="mt-1 text-muted">
        Who's been <span className="marker font-semibold text-ink">saying thanks</span> the most?
      </p>
      <div className="pointer-events-none absolute -top-1 right-0 hidden items-start gap-1 sm:flex">
        <Hand className="mt-1 rotate-3">only kudos given count!</Hand>
        <Arrow className="mt-6 rotate-[70deg]" />
      </div>
    </header>
  );
}

function Segmented<T extends string>({ value, onChange, options, big }: { value: T; onChange: (v: T) => void; options: Array<{ id: T; label: string; sub?: string }>; big?: boolean }) {
  return (
    <div role="tablist" className={`${big ? "grid grid-cols-3" : "inline-flex"} gap-1 rounded-lg border border-line bg-surface-2 p-1`}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={`cursor-pointer rounded-md px-3 text-left transition ${big ? "py-2" : "py-1.5 text-sm"} ${active ? "bg-surface font-bold text-ink shadow-ph ring-1 ring-line-strong" : "font-semibold text-muted hover:text-ink"}`}
          >
            <span className="block truncate">{o.label}</span>
            {big && o.sub && <span className={`block truncate text-xs font-medium ${active ? "text-orange" : "text-faint"}`}>{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

function PrivacyToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
      <span className={`relative h-6 w-10 shrink-0 rounded-full border border-line-strong transition ${on ? "bg-green" : "bg-surface-2"}`}>
        <span className={`absolute top-0.5 size-[18px] rounded-full bg-surface shadow ring-1 ring-line-strong transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
      Show me on the leaderboards
      <span className="rounded bg-surface-2 px-1 font-mono text-[10px] text-faint">stub</span>
    </button>
  );
}

function PeopleBoard({ rows, hidden }: { rows: BoardRow[]; hidden: boolean }) {
  const people = rows.filter((r): r is PersonRow => r.kind === "row");
  const top = people.filter((r) => r.position <= 3);
  const rest = rows.filter((r) => r.kind === "gap" || r.position > 3);
  const meOnPodium = top.some((r) => r.me);

  return (
    <>
      <Podium
        steps={top.map((r) => ({
          key: `${r.position}`,
          position: r.position,
          rank: r.rank,
          tied: isTied(rows, r.rank),
          title: r.name,
          detail: `${r.kudos} kudos`,
          me: r.me,
          hidden: hidden && r.me,
          face: <Avatar initials={r.initials} hue={r.hue} size={44} ring={r.me && !hidden} />,
        }))}
      />
      <ol className="border-t border-line">
        {hidden && meOnPodium && <NoticeRow />}
        {rest.map((r, i) =>
          r.kind === "gap" ? <GapRow key={`gap-${i}`} /> : hidden && r.me ? <NoticeRow key="me" /> : <PersonLine key={r.position} row={r} tied={isTied(rows, r.rank)} />,
        )}
      </ol>
    </>
  );
}

function GroupsBoard({ rows }: { rows: GroupRow[] }) {
  const teams = rows.filter((r): r is TeamRow => r.kind === "row");
  const top = teams.filter((r) => r.position <= 3);
  const rest = rows.filter((r) => r.kind === "gap" || r.position > 3);
  return (
    <>
      <Podium
        steps={top.map((r) => ({
          key: r.group,
          position: r.position,
          rank: r.rank,
          tied: isTied(rows, r.rank),
          title: r.group,
          detail: `${perPerson(r.score)} per person`,
          extra: `${r.participation}% gave · ${r.total} kudos`,
          me: r.mine,
          face: <Hog size={52} mood={r.position === 1 ? "party" : "happy"} hat={r.position === 1 ? "party" : undefined} />,
        }))}
      />
      <ol className="border-t border-line">
        {rest.map((r, i) => (r.kind === "gap" ? <GapRow key={`gap-${i}`} /> : <TeamLine key={r.group} row={r} tied={isTied(rows, r.rank)} />))}
      </ol>
    </>
  );
}

type Step = { key: string; position: number; rank: number; tied: boolean; title: string; detail: string; extra?: string; me?: boolean; hidden?: boolean; face: ReactNode };

const stepHeight: Record<number, string> = { 1: "h-20 sm:h-24", 2: "h-14 sm:h-16", 3: "h-10 sm:h-12" };
const stepOrder = [2, 1, 3];

function Podium({ steps }: { steps: Step[] }) {
  const ordered = stepOrder.map((p) => steps.find((s) => s.position === p)).filter((s): s is Step => s !== undefined);
  return (
    <div className="dotgrid relative overflow-hidden rounded-t-lg px-3 pt-6 sm:px-8">
      <Hand className="absolute left-3 top-2 -rotate-3 text-lg sm:left-6">thank-you champs 💛</Hand>
      <div className="mx-auto grid max-w-xl grid-cols-3 items-end gap-2 sm:gap-4">
        {ordered.map((s) => (
          <PodiumStep key={s.key} step={s} />
        ))}
      </div>
    </div>
  );
}

function PodiumStep({ step }: { step: Step }) {
  if (step.hidden) {
    return (
      <div className="flex flex-col items-center text-center">
        <Hog size={48} mood="sleepy" />
        <div className="mt-1 text-xs font-semibold text-faint">That's you, hidden</div>
        <div className={`mt-2 w-full rounded-t-md border-2 border-b-0 border-dashed border-line-strong ${stepHeight[step.position]}`} />
      </div>
    );
  }
  return (
    <div className={`flex min-w-0 flex-col items-center text-center ${step.position === 1 ? "animate-pop" : ""}`}>
      {step.face}
      <div className={`mt-1 w-full truncate font-display text-sm font-extrabold sm:text-base ${step.me ? "marker" : ""}`}>{step.title}</div>
      <div className="text-xs font-semibold text-muted">{step.detail}</div>
      {step.extra && <div className="hidden text-[11px] text-faint sm:block">{step.extra}</div>}
      {step.me && (
        <div className="mt-1">
          <Pill tone="orange">you</Pill>
        </div>
      )}
      <div
        className={`mt-2 flex w-full items-start justify-center rounded-t-md border border-b-0 border-line-strong pt-1.5 ${stepHeight[step.position]} ${step.position === 1 ? "bg-marker" : "bg-surface-2"}`}
      >
        <span className="text-2xl leading-none sm:text-3xl" aria-label={`rank ${step.rank}`}>
          {medal(step.rank)}
        </span>
      </div>
      {step.tied && <div className="sr-only">tied</div>}
    </div>
  );
}

function RankCell({ rank, tied }: { rank: number; tied: boolean }) {
  return (
    <span className="flex w-9 shrink-0 flex-col items-end leading-none">
      <span className="font-display text-base font-black tabular-nums">{medal(rank)}</span>
      {tied && <span className="mt-0.5 text-[10px] font-semibold uppercase text-faint">tied</span>}
    </span>
  );
}

function PersonLine({ row, tied }: { row: PersonRow; tied: boolean }) {
  return (
    <li className={`flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 ${row.me ? "bg-marker/60" : ""}`}>
      <RankCell rank={row.rank} tied={tied} />
      <Avatar initials={row.initials} hue={row.hue} size={30} ring={row.me} />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-semibold">{row.name}</span>
        {row.me && <Pill tone="orange">you</Pill>}
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">{row.kudos} kudos</span>
    </li>
  );
}

function TeamLine({ row, tied }: { row: TeamRow; tied: boolean }) {
  return (
    <li className={`flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 ${row.mine ? "bg-marker/60" : ""}`}>
      <RankCell rank={row.rank} tied={tied} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{row.group}</span>
          {row.mine && <Pill tone="orange">your group</Pill>}
        </span>
        <span className="block text-xs text-muted tabular-nums">
          {perPerson(row.score)} per person · {row.participation}% gave · {row.total} kudos
        </span>
      </span>
    </li>
  );
}

function GapRow() {
  return (
    <li aria-label="Skipped positions" className="flex items-center gap-3 border-b border-line px-4 py-1 text-faint">
      <span className="h-px flex-1 border-t border-dashed border-line-strong" />
      <span className="font-display text-lg font-black leading-none">…</span>
      <span className="h-px flex-1 border-t border-dashed border-line-strong" />
    </li>
  );
}

function NoticeRow() {
  return (
    <li className="flex items-center gap-3 border-b border-line bg-surface-2 px-4 py-3 text-sm text-muted">
      <span className="text-lg">🙈</span>
      <span>
        You're not on the leaderboards. You can change that in{" "}
        <a href="#/profile" className="font-semibold text-orange underline decoration-dotted underline-offset-2">
          Settings
        </a>
        .
      </span>
    </li>
  );
}

function GroupLines({ myGroupLine, mostImproved }: { myGroupLine?: string; mostImproved?: string }) {
  if (!myGroupLine && !mostImproved) return null;
  return (
    <div className="space-y-2 rounded-lg border border-line bg-surface-2 p-4 text-sm">
      {myGroupLine && (
        <p>
          <span className="font-bold">{me.primaryGroup.name}:</span> {myGroupLine}
        </p>
      )}
      {mostImproved && <p className="font-semibold">📈 Most improved: {mostImproved}</p>}
    </div>
  );
}

function PrivateLines({ lines }: { lines: Array<string | undefined> }) {
  const shown = lines.filter((l): l is string => Boolean(l));
  if (shown.length === 0) return null;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-2 p-4">
      <Hog size={44} mood="happy" className="shrink-0" />
      <div className="space-y-1 text-sm">
        <div className="text-xs font-bold uppercase tracking-wide text-faint">🔒 Just for you</div>
        {shown.map((l) => (
          <p key={l} className="font-semibold">
            {l}
          </p>
        ))}
      </div>
    </div>
  );
}

function Footnote() {
  return (
    <aside className="flex items-start gap-3 rounded-lg border-2 border-dashed border-line-strong p-4 text-sm text-muted">
      <Hog size={48} mood="thinking" hat="glasses" className="shrink-0" />
      <div className="space-y-1.5">
        <p>
          <span className="font-bold text-ink">Psst, how this works:</span> these boards count <span className="marker font-semibold text-ink">kudos given</span>, and
          nothing else. Kudos received, XP, levels, coins and achievements never rank here. Saying thanks is the whole game.
        </p>
        <p>Groups are scored per person, so a small team can top the board. Only signed-in members see the people boards.</p>
      </div>
    </aside>
  );
}
