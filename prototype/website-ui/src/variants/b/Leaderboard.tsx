// Variant B leaderboard: a race track where every racer sits at its share of the leader's kudos given, with the finish line on the right.
import { useState, type CSSProperties, type ReactNode } from "react";
import { IconCrown, IconLock } from "@posthog/icons";
import { Label, Switch, Tabs, TabsContent, TabsList, TabsTrigger, ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { HedgehogSuperhero } from "@posthog/brand/hoggies";
import { boards, me } from "../../data/mock";
import type { BoardRow, GroupRow, Period } from "../../data/types";
import { CountUp, Panel, Tag, useHud, useMounted } from "./hud";

type PersonRow = Extract<BoardRow, { kind: "row" }>;
type TeamRow = Extract<GroupRow, { kind: "row" }>;

const periods: Array<{ id: Period; label: string }> = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

export function Leaderboard(_props: { param?: string }) {
  useHud();
  const [period, setPeriod] = useState<Period>("week");
  const [showMe, setShowMe] = useState(me.privacy.showOnLeaderboards);
  const facts = boards[period];

  return (
    <div className="flex flex-col gap-5">
      <header className="hud-rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="hud-label">Leaderboard</div>
          <h1 className="hud-display mt-1 text-4xl font-bold leading-none">The race</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Who has been saying thanks the most. Only kudos given move a racer; kudos received, XP, levels, coins and achievements never rank.</p>
        </div>
        <Label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch size="sm" checked={showMe} onCheckedChange={setShowMe} />
          Show me on the leaderboards
        </Label>
      </header>

      <Tabs defaultValue="groups" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="groups">Groups</TabsTrigger>
            <TabsTrigger value="myGroup">{me.primaryGroup.name}</TabsTrigger>
            <TabsTrigger value="everyone">Everyone</TabsTrigger>
          </TabsList>
          <ToggleGroup variant="outline" size="sm" value={[period]} onValueChange={(v) => v[0] && setPeriod(v[0] as Period)} aria-label="Period">
            {periods.map((p) => (
              <ToggleGroupItem key={p.id} value={p.id}>
                {p.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <TabsContent value="groups" className="flex flex-col gap-3">
          <GroupTrack key={period} rows={facts.groups.rows} />
          <PrivateLines
            note="Groups are scored per person, so a small group can win the race."
            lines={[facts.groups.myGroupLine && `${me.primaryGroup.name}: ${facts.groups.myGroupLine}`, facts.groups.mostImproved && `Most improved: ${facts.groups.mostImproved}`]}
          />
        </TabsContent>
        <TabsContent value="myGroup" className="flex flex-col gap-3">
          <PeopleTrack key={period} rows={facts.myGroup.rows} showMe={showMe} />
        </TabsContent>
        <TabsContent value="everyone" className="flex flex-col gap-3">
          <PeopleTrack key={period} rows={facts.everyone.rows} showMe={showMe} />
          <PrivateLines lines={[facts.everyone.improvementLine, facts.everyone.peerLine]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const share = (value: number, max: number) => (max > 0 ? (value / max) * 100 : 0);

const tied = (rank: number, ranks: number[]) => ranks.filter((r) => r === rank).length > 1;

function PeopleTrack({ rows, showMe }: { rows: BoardRow[]; showMe: boolean }) {
  const people = rows.filter((r): r is PersonRow => r.kind === "row");
  const max = Math.max(...people.map((r) => r.kudos));
  const ranks = people.map((r) => r.rank);
  const mounted = useMounted();
  return (
    <Panel flush label="Kudos given" action={<Finish />}>
      <ol className="flex flex-col">
        {rows.map((row, i) => {
          if (row.kind === "gap") return <GapLane key={`gap-${i}`} />;
          if (row.me && !showMe) return <HiddenLane key="me" />;
          return (
            <Lane key={row.position} rank={row.rank} tie={tied(row.rank, ranks)} highlight={row.me} pct={mounted ? share(row.kudos, max) : 0} racer={<Racer row={row} />} value={<CountUp value={row.kudos} />}>
              <span className="truncate font-medium">{row.name}</span>
              {row.me && <Tag>You</Tag>}
            </Lane>
          );
        })}
      </ol>
    </Panel>
  );
}

function GroupTrack({ rows }: { rows: GroupRow[] }) {
  const teams = rows.filter((r): r is TeamRow => r.kind === "row");
  const max = Math.max(...teams.map((r) => r.score));
  const ranks = teams.map((r) => r.rank);
  const mounted = useMounted();
  return (
    <Panel flush label="Kudos given per person" action={<Finish />}>
      <ol className="flex flex-col">
        {rows.map((row, i) => {
          if (row.kind === "gap") return <GapLane key={`gap-${i}`} />;
          return (
            <Lane key={row.group} rank={row.rank} tie={tied(row.rank, ranks)} highlight={row.mine} pct={mounted ? share(row.score, max) : 0} racer={<TeamRacer row={row} />} value={<span className="tabular-nums">{row.score.toFixed(1)}</span>}>
              <span className="truncate font-medium">{row.group}</span>
              {row.mine && <Tag>Your group</Tag>}
              <span className="ml-auto hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:inline">
                {row.participation}% gave · {row.total} total
              </span>
            </Lane>
          );
        })}
      </ol>
    </Panel>
  );
}

function Lane({ rank, tie, highlight, pct, racer, value, children }: { rank: number; tie: boolean; highlight?: boolean; pct: number; racer: ReactNode; value: ReactNode; children: ReactNode }) {
  return (
    <li className={`grid grid-cols-[2.25rem_minmax(0,1fr)_3.5rem] items-center gap-3 border-t px-3 py-2.5 first:border-t-0 ${highlight ? "bg-fill-selected shadow-[inset_3px_0_0_var(--primary)]" : ""}`}>
      <RankMark rank={rank} tie={tie} />
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center gap-2 text-sm">{children}</div>
        <div className="relative h-6 rounded-full bg-muted ring-1 ring-inset ring-border">
          <div className="absolute inset-x-3 top-1/2 border-t border-dashed border-border" aria-hidden />
          <div className="hud-fill absolute inset-y-0 left-0 rounded-full bg-primary/15" style={{ width: `${pct}%` }} aria-hidden />
          <div className="hud-finish absolute inset-y-0 right-0 w-2 rounded-r-full opacity-60" aria-hidden />
          <div className="hud-racer absolute top-1/2 flex" style={{ left: `${pct}%`, transform: `translate(-${pct}%, -50%)` }}>
            {racer}
          </div>
        </div>
      </div>
      <div className="hud-display text-right text-xl font-bold leading-none">{value}</div>
    </li>
  );
}

function RankMark({ rank, tie }: { rank: number; tie: boolean }) {
  const top = rank <= 3;
  return (
    <span className={`flex flex-col items-center justify-center leading-none ${top ? "text-foreground" : "text-muted-foreground"}`} aria-label={`Rank ${rank}${tie ? ", tied" : ""}`}>
      {rank === 1 && <IconCrown className="size-4 text-primary" />}
      <span className={`hud-display font-bold tabular-nums ${top ? "text-2xl" : "text-lg"}`}>
        {rank}
        {tie && <span className="text-xs font-normal text-muted-foreground">=</span>}
      </span>
    </span>
  );
}

function Racer({ row }: { row: PersonRow }) {
  if (row.me) return <HedgehogSuperhero size={34} className="drop-shadow-md" title="You" />;
  return <Bubble style={{ boxShadow: `0 0 0 2px var(--card), 0 0 0 3.5px hsl(${row.hue} 55% 55%)` }}>{row.initials}</Bubble>;
}

function TeamRacer({ row }: { row: TeamRow }) {
  if (row.mine) return <HedgehogSuperhero size={34} className="drop-shadow-md" title="Your group" />;
  return <Bubble style={{ boxShadow: "0 0 0 2px var(--card), 0 0 0 3.5px var(--border)" }}>{row.group.replace("Team ", "").slice(0, 2).toUpperCase()}</Bubble>;
}

function Bubble({ style, children }: { style: CSSProperties; children: ReactNode }) {
  return (
    <span className="flex size-7 items-center justify-center rounded-full bg-card text-[10px] font-semibold text-foreground" style={style}>
      {children}
    </span>
  );
}

function Finish() {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="hud-finish inline-block h-3 w-4 rounded-sm" aria-hidden /> Finish = the leader
    </span>
  );
}

function GapLane() {
  return (
    <li className="flex items-center gap-3 border-t px-3 py-1.5 text-[11px] text-muted-foreground" aria-label="Skipped positions">
      <span className="flex-1 border-t border-dashed" />
      positions skipped
      <span className="flex-1 border-t border-dashed" />
    </li>
  );
}

function HiddenLane() {
  return (
    <li className="border-t bg-fill-selected px-3 py-3 text-sm text-muted-foreground shadow-[inset_3px_0_0_var(--primary)]">
      You're not on the leaderboards. Flip “Show me on the leaderboards” above to join the race.
    </li>
  );
}

function PrivateLines({ lines, note }: { lines: Array<string | undefined>; note?: ReactNode }) {
  const shown = lines.filter((l): l is string => Boolean(l));
  if (shown.length === 0 && !note) return null;
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      {note && <p>{note}</p>}
      {shown.length > 0 && (
        <>
          <p className="flex items-center gap-1 font-medium">
            <IconLock className="size-3.5" /> Only you see these
          </p>
          {shown.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </>
      )}
    </div>
  );
}
