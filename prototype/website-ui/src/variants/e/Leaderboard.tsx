// Variant E leaderboard: C's front-page headline, plain numbered board and editor's notes, set in B's HUD language.
import { useState, type ReactNode } from "react";
import { IconCrown, IconLock } from "@posthog/icons";
import { Label, Switch, Tabs, TabsList, TabsTrigger, ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { boards, me } from "../../data/mock";
import type { BoardRow, GroupRow, Period } from "../../data/types";
import { CountUp, Panel, Tag, useHud } from "../b/hud";
import { useHogs } from "./hedgehogs";
import { groupStory, peopleStory, type PersonRow, type TeamRow } from "./leaderboard-story";

type Edition = "groups" | "myGroup" | "everyone";

const periods: Array<{ id: Period; label: string; phrase: string }> = [
  { id: "week", label: "This week", phrase: "the week" },
  { id: "month", label: "This month", phrase: "the month" },
  { id: "all", label: "All time", phrase: "all time" },
];

const editions: Array<{ id: Edition; label: string }> = [
  { id: "groups", label: "Groups" },
  { id: "myGroup", label: "My group" },
  { id: "everyone", label: "Everyone" },
];

export function Leaderboard({ param }: { param?: string }) {
  useHud();
  const [period, setPeriod] = useState<Period>(param === "month" || param === "all" ? param : "week");
  const [edition, setEdition] = useState<Edition>("everyone");
  const [showMe, setShowMe] = useState(me.privacy.showOnLeaderboards);
  const facts = boards[period];
  const phrase = periods.find((p) => p.id === period)?.phrase ?? "";
  const people = edition === "myGroup" ? facts.myGroup.rows : facts.everyone.rows;
  const story = edition === "groups" ? groupStory(facts.groups.rows, phrase) : peopleStory(people, phrase, showMe);

  return (
    <div className="flex flex-col gap-5">
      <header className="hud-rise flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={edition} onValueChange={(v) => setEdition(v as Edition)}>
          <TabsList>
            {editions.map((e) => (
              <TabsTrigger key={e.id} value={e.id}>
                {e.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <ToggleGroup variant="outline" size="sm" value={[period]} onValueChange={(v) => v[0] && setPeriod(v[0] as Period)} aria-label="Period">
            {periods.map((p) => (
              <ToggleGroupItem key={p.id} value={p.id}>
                {p.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch size="sm" checked={showMe} onCheckedChange={setShowMe} />
            Show me on the leaderboards
          </Label>
        </div>
      </header>

      <Panel className="hud-root hud-rise overflow-hidden" bodyClassName="flex flex-col gap-3 py-2 sm:py-4">
        <span className="hud-label">Front page · {edition === "groups" ? "groups" : edition === "myGroup" ? me.primaryGroup.name : "everyone"} · {periods.find((p) => p.id === period)?.label.toLowerCase()}</span>
        <h1 key={`${edition}-${period}`} className="hud-display hud-rise text-[clamp(2.25rem,7vw,4.75rem)] font-bold leading-[0.95] text-balance">
          {story.headline}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {story.deck} Only kudos given count here; kudos received, XP, levels, coins and achievements never rank anyone.
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        {edition === "groups" ? <GroupsBoard key={period} rows={facts.groups.rows} /> : <PeopleBoard key={`${edition}-${period}`} rows={people} showMe={showMe} />}
        <EditorsNotes
          note={edition === "groups" ? "Groups are scored per person, so a small group can top the board." : undefined}
          lines={
            edition === "groups"
              ? [facts.groups.myGroupLine && `${me.primaryGroup.name}: ${facts.groups.myGroupLine}`, facts.groups.mostImproved && `Most improved: ${facts.groups.mostImproved}`]
              : edition === "everyone"
                ? [facts.everyone.improvementLine, facts.everyone.peerLine]
                : []
          }
        />
      </div>
    </div>
  );
}

const rankCounts = (rows: Array<BoardRow | GroupRow>) => {
  const counts = new Map<number, number>();
  rows.forEach((r) => r.kind === "row" && counts.set(r.rank, (counts.get(r.rank) ?? 0) + 1));
  return (rank: number) => (counts.get(rank) ?? 0) > 1;
};

function PeopleBoard({ rows, showMe }: { rows: BoardRow[]; showMe: boolean }) {
  const tied = rankCounts(rows);
  return (
    <Panel flush label="No. · member" action={<span className="hud-label pr-1">Kudos given</span>}>
      <ol className="flex flex-col">
        {rows.map((row, i) => {
          if (row.kind === "gap") return <GapLine key={`gap-${i}`} />;
          if (row.me && !showMe) return <HiddenLine key="me" />;
          return <PersonLine key={row.position} row={row} tie={tied(row.rank)} />;
        })}
      </ol>
    </Panel>
  );
}

function PersonLine({ row, tie }: { row: PersonRow; tie: boolean }) {
  return (
    <Line rank={row.rank} tie={tie} highlight={row.me} value={<CountUp value={row.kudos} />}>
      {row.me ? <MyHog /> : <Bubble initials={row.initials} hue={row.hue} />}
      <span className="truncate font-medium">{row.name}</span>
      {row.me && <Tag variant="info">You</Tag>}
    </Line>
  );
}

function GroupsBoard({ rows }: { rows: GroupRow[] }) {
  const tied = rankCounts(rows);
  return (
    <Panel flush label="No. · group" action={<span className="hud-label pr-1">Per person</span>}>
      <ol className="flex flex-col">
        {rows.map((row, i) =>
          row.kind === "gap" ? (
            <GapLine key={`gap-${i}`} />
          ) : (
            <Line key={row.group} rank={row.rank} tie={tied(row.rank)} highlight={row.mine} value={row.score.toFixed(1)}>
              <TeamLine row={row} />
            </Line>
          ),
        )}
      </ol>
    </Panel>
  );
}

function TeamLine({ row }: { row: TeamRow }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium">{row.group}</span>
        {row.mine && <Tag variant="info">Your group</Tag>}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground sm:ml-auto">
        {row.participation}% gave · {row.total} total
      </span>
    </span>
  );
}

function Line({ rank, tie, highlight, value, children }: { rank: number; tie: boolean; highlight?: boolean; value: ReactNode; children: ReactNode }) {
  return (
    <li className={`grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 border-t px-3 py-2.5 ${highlight ? "bg-fill-selected shadow-[inset_3px_0_0_var(--primary)]" : ""}`}>
      <RankMark rank={rank} tie={tie} />
      <span className="flex min-w-0 items-center gap-2.5 text-sm">{children}</span>
      <span className="hud-display text-right text-xl font-bold tabular-nums leading-none">{value}</span>
    </li>
  );
}

function RankMark({ rank, tie }: { rank: number; tie: boolean }) {
  return (
    <span className={`flex items-center gap-1 leading-none ${rank <= 3 ? "text-foreground" : "text-muted-foreground"}`} aria-label={`Rank ${rank}${tie ? ", tied" : ""}`}>
      <span className="hud-display text-2xl font-bold tabular-nums">{String(rank).padStart(2, "0")}</span>
      {rank === 1 ? <IconCrown className="size-3.5 text-primary" /> : tie && <span className="text-xs text-muted-foreground">=</span>}
    </span>
  );
}

function MyHog() {
  const { equipped } = useHogs();
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card ring-2 ring-primary/60">
      <equipped.Art size={30} title={`You, as ${equipped.name}`} />
    </span>
  );
}

function Bubble({ initials, hue }: { initials: string; hue: number }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-[11px] font-semibold" style={{ boxShadow: `inset 0 0 0 1.5px hsl(${hue} 55% 55%)` }}>
      {initials}
    </span>
  );
}

function GapLine() {
  return (
    <li className="border-t px-3 py-1 text-center text-lg leading-none tracking-[0.3em] text-muted-foreground" aria-label="Skipped positions">
      …
    </li>
  );
}

function HiddenLine() {
  return (
    <li className="border-t bg-fill-selected px-3 py-3 text-sm text-muted-foreground shadow-[inset_3px_0_0_var(--primary)]">You're off the board by choice. Flip “Show me on the leaderboards” to come back.</li>
  );
}

function EditorsNotes({ lines, note }: { lines: Array<string | undefined>; note?: string }) {
  const shown = lines.filter((l): l is string => Boolean(l));
  if (shown.length === 0 && !note) return null;
  return (
    <Panel label="Editor's notes" bodyClassName="flex flex-col gap-3 text-sm">
      {note && <p className="text-muted-foreground">{note}</p>}
      {shown.length > 0 && (
        <>
          <p className="hud-label flex items-center gap-1.5">
            <IconLock className="size-3.5" /> Only you see these
          </p>
          {shown.map((line) => (
            <p key={line} className="border-l-2 border-primary/60 pl-3 leading-relaxed">
              {line}
            </p>
          ))}
        </>
      )}
    </Panel>
  );
}
