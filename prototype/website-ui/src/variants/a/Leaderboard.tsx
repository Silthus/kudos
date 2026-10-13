// PROTOTYPE leaderboard as a trends breakdown: kudos given, one bar per person or group, the viewer highlighted.
import { useState } from "react";
import { IconCalendar } from "@posthog/icons";
import { Label, Switch, Tabs, TabsContent, TabsList, TabsTrigger, ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { boards, me } from "../../data/mock";
import type { BoardRow, GroupRow, Period } from "../../data/types";
import { Initials } from "../../ui";
import { Bar, series } from "./charts";
import { BigNumber, Insight, MaxLine, Tag } from "./insight";

type PersonRow = Extract<BoardRow, { kind: "row" }>;
type TeamRow = Extract<GroupRow, { kind: "row" }>;

const periods: Array<{ id: Period; label: string }> = [
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

export function DashboardLeaderboard(_props: { param?: string }) {
  const [period, setPeriod] = useState<Period>("week");
  const [board, setBoard] = useState("everyone");
  const [showMe, setShowMe] = useState(me.privacy.showOnLeaderboards);
  const facts = boards[period];
  const periodLabel = periods.find((p) => p.id === period)?.label ?? "";
  const myRow = (board === "myGroup" ? facts.myGroup.rows : facts.everyone.rows).find((r): r is PersonRow => r.kind === "row" && r.me === true);
  const myGroupRow = facts.groups.rows.find((r): r is TeamRow => r.kind === "row" && r.mine === true);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">Kudos given</h1>
        <Tag variant="info">Trends · breakdown</Tag>
        <ToggleGroup variant="outline" size="sm" className="ml-auto" value={[period]} onValueChange={(v) => v[0] && setPeriod(v[0] as Period)} aria-label="Period">
          {periods.map((p) => (
            <ToggleGroupItem key={p.id} value={p.id}>
              {p.id === "week" && <IconCalendar className="size-3.5" />}
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <Tabs value={board} onValueChange={(v) => setBoard(String(v))} className="flex flex-col gap-4">
        <Insight
          hero
          title={`Kudos given · ${periodLabel}`}
          description="Only kudos given count here. Received, XP, levels, coins and achievements never rank anyone."
          actions={
            <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
              <Switch size="sm" checked={showMe} onCheckedChange={setShowMe} />
              Show me
            </Label>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Breakdown by
                <TabsList variant="default">
                  <TabsTrigger value="groups">Group</TabsTrigger>
                  <TabsTrigger value="myGroup">{me.primaryGroup.name}</TabsTrigger>
                  <TabsTrigger value="everyone">Everyone</TabsTrigger>
                </TabsList>
              </div>
              {board === "groups" ? (
                <BigNumber value={myGroupRow ? myGroupRow.score.toFixed(1) : "–"} unit={`per person · ${me.primaryGroup.name}`} />
              ) : (
                <BigNumber value={showMe && myRow ? myRow.kudos : "–"} unit={showMe && myRow ? `kudos · rank ${myRow.rank}` : "hidden"} />
              )}
            </div>
            <TabsContent value="groups">
              <TeamBars rows={facts.groups.rows} />
            </TabsContent>
            <TabsContent value="myGroup">
              <PeopleBars rows={facts.myGroup.rows} showMe={showMe} />
            </TabsContent>
            <TabsContent value="everyone">
              <PeopleBars rows={facts.everyone.rows} showMe={showMe} />
            </TabsContent>
          </div>
        </Insight>

        <TabsContent value="groups">
          <MaxLine lines={[facts.groups.myGroupLine && `${me.primaryGroup.name}: ${facts.groups.myGroupLine}`, facts.groups.mostImproved && `Most improved: ${facts.groups.mostImproved}`]}>
            Groups are scored per person, so a small group can top the board.
          </MaxLine>
        </TabsContent>
        <TabsContent value="myGroup">
          <MaxLine>Your group's own board. Ties share a rank, and the window keeps the top 3 plus the people around you.</MaxLine>
        </TabsContent>
        <TabsContent value="everyone">
          <MaxLine lines={[facts.everyone.improvementLine, facts.everyone.peerLine]}>{showMe ? "Everyone who opted in, with you in the window." : "You're hidden from the leaderboards, so nobody can find you on them. Flip the switch to join in."}</MaxLine>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const rankOf = (rank: number) => (rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : `${rank}`);

function PeopleBars({ rows, showMe }: { rows: BoardRow[]; showMe: boolean }) {
  const peak = Math.max(...rows.map((r) => (r.kind === "row" ? r.kudos : 0)), 1);
  return (
    <div className="flex flex-col gap-1">
      {rows.map((row, i) => {
        if (row.kind === "gap") return <GapLine key={`gap-${i}`} before={rows[i - 1]} after={rows[i + 1]} />;
        if (row.me && !showMe) return <HiddenLine key="me" />;
        return (
          <div key={row.position} className={`grid grid-cols-[1.5rem_minmax(0,7rem)_minmax(0,1fr)_2rem] items-center gap-2 rounded-md px-1.5 py-1 sm:grid-cols-[2rem_1.75rem_minmax(0,12rem)_minmax(0,1fr)_3rem] ${row.me ? "bg-fill-selected" : ""}`}>
            <span className="text-center text-xs tabular-nums text-muted-foreground">{rankOf(row.rank)}</span>
            <span className="hidden sm:block">
              <Initials name={row.name} size={26} />
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-medium">{row.name}</span>
              {row.me && <Tag>You</Tag>}
            </span>
            <Bar value={row.kudos} max={peak} color={row.me ? series(1) : `color-mix(in oklab, ${series(1)} 45%, var(--muted))`} />
            <span className="text-right text-sm font-semibold tabular-nums">{row.kudos}</span>
          </div>
        );
      })}
    </div>
  );
}

function TeamBars({ rows }: { rows: GroupRow[] }) {
  const peak = Math.max(...rows.map((r) => (r.kind === "row" ? r.score : 0)), 1);
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[1.5rem_minmax(0,6.5rem)_minmax(0,1fr)_2.5rem_2.5rem] gap-2 px-1.5 text-[10px] font-medium text-muted-foreground sm:grid-cols-[2rem_minmax(0,12rem)_minmax(0,1fr)_3.5rem_3rem_3rem]">
        <span />
        <span>Group</span>
        <span>Per person</span>
        <span className="text-right">Gave</span>
        <span className="text-right">Score</span>
        <span className="hidden text-right sm:block">Total</span>
      </div>
      {rows.map((row, i) => {
        if (row.kind === "gap") return <GapLine key={`gap-${i}`} />;
        return (
          <div key={row.group} className={`grid grid-cols-[1.5rem_minmax(0,6.5rem)_minmax(0,1fr)_2.5rem_2.5rem] items-center gap-2 rounded-md px-1.5 py-1 sm:grid-cols-[2rem_minmax(0,12rem)_minmax(0,1fr)_3.5rem_3rem_3rem] ${row.mine ? "bg-fill-selected" : ""}`}>
            <span className="text-center text-xs tabular-nums text-muted-foreground">{rankOf(row.rank)}</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-medium">{row.group}</span>
              {row.mine && <Tag>Yours</Tag>}
            </span>
            <Bar value={row.score} max={peak} color={row.mine ? series(1) : `color-mix(in oklab, ${series(1)} 45%, var(--muted))`} />
            <span className="text-right text-xs tabular-nums text-muted-foreground">{row.participation}%</span>
            <span className="text-right text-sm font-semibold tabular-nums">{row.score.toFixed(1)}</span>
            <span className="hidden text-right text-xs tabular-nums text-muted-foreground sm:block">{row.total}</span>
          </div>
        );
      })}
    </div>
  );
}

function GapLine({ before, after }: { before?: BoardRow; after?: BoardRow }) {
  const from = before?.kind === "row" ? before.position + 1 : undefined;
  const to = after?.kind === "row" ? after.position - 1 : undefined;
  return (
    <div className="flex items-center gap-2 px-1.5 py-1 text-[11px] text-muted-foreground" aria-label="Skipped positions">
      <span className="h-px flex-1 border-t border-dashed" />
      {from !== undefined && to !== undefined ? `positions ${from} to ${to}` : "…"}
      <span className="h-px flex-1 border-t border-dashed" />
    </div>
  );
}

function HiddenLine() {
  return (
    <div className="rounded-md bg-fill-selected px-2 py-1.5 text-xs text-muted-foreground">
      You're not on the leaderboards. The “Show me” switch above changes that.
    </div>
  );
}
