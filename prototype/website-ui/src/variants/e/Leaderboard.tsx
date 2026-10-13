// Variant E leaderboard: three big board cards as the primary switch, a headline over a podium, the rest of the window in HUD rows, and private notes beside it.
import { useState, type ComponentType, type ReactNode } from "react";
import { IconGlobe, IconGroups, IconLock, IconPeople, IconTrending } from "@posthog/icons";
import { Switch, ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { boards, me } from "../../data/mock";
import type { BoardRow, Boards, GroupRow, Period } from "../../data/types";
import { CountUp, Panel, Tag, useHud } from "./hud";
import { GroupCrest, HiddenFace, MemberFace } from "./leaderboard-faces";
import { Podium, type Spot } from "./leaderboard-podium";
import { readRoute, writeRoute, type Board } from "./leaderboard-route";
import { groupStanding, groupStory, peopleStory, personStanding, splitPodium, tiedRanks, type PersonRow, type TeamRow } from "./leaderboard-story";

const periods: Array<{ id: Period; label: string; phrase: string }> = [
  { id: "week", label: "This week", phrase: "the week" },
  { id: "month", label: "This month", phrase: "the month" },
  { id: "all", label: "All time", phrase: "all time" },
];

type BoardInfo = { id: Board; label: string; blurb: string; Icon: ComponentType<{ className?: string }>; standing: (facts: Boards, showMe: boolean) => Standing };

type Standing = { rank?: number; text: string; short: string };

const boardInfo: BoardInfo[] = [
  { id: "groups", label: "Groups", blurb: "Teams ranked by kudos per person", Icon: IconGroups, standing: (facts) => groupStanding(facts.groups.rows) },
  { id: "group", label: "My group", blurb: `Everyone in ${me.primaryGroup.name}`, Icon: IconPeople, standing: (facts, showMe) => personStanding(facts.myGroup.rows, showMe) },
  { id: "everyone", label: "Everyone", blurb: "The whole company on one board", Icon: IconGlobe, standing: (facts, showMe) => personStanding(facts.everyone.rows, showMe) },
];

export function Leaderboard({ param }: { param?: string }) {
  useHud();
  const { board, period } = readRoute(param);
  const [showMe, setShowMe] = useState(me.privacy.showOnLeaderboards);
  const facts = boards[period];
  const when = periods.find((p) => p.id === period) ?? periods[0];
  const people = board === "group" ? facts.myGroup.rows : facts.everyone.rows;
  const story = board === "groups" ? groupStory(facts.groups.rows, when.phrase) : peopleStory(people, when.phrase, showMe);
  const boardName = board === "groups" ? "All groups" : board === "group" ? me.primaryGroup.name : "Everyone";

  return (
    <div className="flex flex-col gap-5">
      <section className="hud-rise flex flex-col gap-3" aria-label="Boards">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="hud-label">Leaderboard · kudos given</span>
          <ToggleGroup variant="outline" size="sm" value={[period]} onValueChange={(v) => v[0] && writeRoute(board, v[0] as Period)} aria-label="Period">
            {periods.map((p) => (
              <ToggleGroupItem key={p.id} value={p.id}>
                {p.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div role="tablist" aria-label="Board" className="grid grid-cols-3 gap-2 sm:gap-3">
          {boardInfo.map((info) => (
            <BoardCard key={info.id} info={info} selected={info.id === board} standing={info.standing(facts, showMe)} onSelect={() => writeRoute(info.id, period)} />
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div key={`${board}-${period}`} className="flex min-w-0 flex-col gap-5" role="tabpanel" aria-label={`${boardName}, ${when.label.toLowerCase()}`}>
          <Panel label={`${boardName} · ${when.label}`} bodyClassName="flex flex-col gap-6 pb-1 pt-1">
            <div className="flex flex-col gap-2">
              <h1 className="hud-display text-[clamp(1.75rem,5vw,3rem)] font-bold leading-[0.95] text-balance">{story.headline}</h1>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{story.deck}</p>
            </div>
            {board === "groups" ? <GroupPodium rows={facts.groups.rows} /> : <PeoplePodium rows={people} showMe={showMe} />}
          </Panel>
          {board === "groups" ? <GroupRows rows={facts.groups.rows} /> : <PeopleRows rows={people} showMe={showMe} />}
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-24">
          <PrivateNotes board={board} facts={facts} />
          <Panel label="How it counts" bodyClassName="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              {board === "groups" ? "Groups score kudos given per person, so a small group can top the board. The share who gave sits beside it." : "Only kudos given count. Kudos received, XP, levels, coins and achievements never rank anyone."}
            </p>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              Show me on the leaderboards
              <Switch size="sm" checked={showMe} onCheckedChange={setShowMe} />
            </label>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function BoardCard({ info, selected, standing, onSelect }: { info: BoardInfo; selected: boolean; standing: Standing; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`relative flex min-w-0 flex-col gap-2 rounded-xl border p-3 text-left transition-colors sm:p-4 ${selected ? "hud-panel border-primary/60 bg-fill-selected shadow-[inset_0_-3px_0_var(--primary)]" : "hud-lift bg-card hover:bg-fill-hover"}`}
    >
      <span className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10 ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`} aria-hidden>
          <info.Icon className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="hud-display block truncate text-base font-bold leading-tight sm:text-xl">{info.label}</span>
          <span className="hidden truncate text-xs text-muted-foreground sm:block">{info.blurb}</span>
        </span>
      </span>
      <span className="flex items-baseline gap-1 text-xs text-muted-foreground sm:text-sm">
        {standing.rank === undefined ? (
          standing.text
        ) : (
          <>
            <span className="hidden sm:inline">{standing.text}</span>
            <span className="sm:hidden">{standing.short}</span>
            <span className={`hud-display text-lg font-bold leading-none sm:text-2xl ${selected ? "text-foreground" : "text-foreground/80"}`}>#{standing.rank}</span>
          </>
        )}
      </span>
    </button>
  );
}

function PeoplePodium({ rows, showMe }: { rows: BoardRow[]; showMe: boolean }) {
  const tied = tiedRanks(rows);
  const spots: Spot[] = splitPodium(rows).podium.map((row) => {
    const hidden = row.me && !showMe;
    return {
      key: String(row.position),
      rank: row.rank,
      tie: tied(row.rank),
      mine: Boolean(row.me) && !hidden,
      face: (size) => (hidden ? <HiddenFace size={size} /> : <MemberFace name={row.name} me={row.me} size={size} />),
      name: hidden ? "Off the board" : row.name,
      value: hidden ? "–" : <CountUp value={row.kudos} />,
      unit: "kudos",
    };
  });
  return <Podium spots={spots} />;
}

function GroupPodium({ rows }: { rows: GroupRow[] }) {
  const tied = tiedRanks(rows);
  const spots: Spot[] = splitPodium(rows).podium.map((row) => ({
    key: row.group,
    rank: row.rank,
    tie: tied(row.rank),
    mine: Boolean(row.mine),
    face: (size) => <GroupCrest group={row.group} mine={row.mine} size={size} />,
    name: row.group,
    value: row.score.toFixed(1),
    unit: "per person",
    detail: `${row.participation}% gave · ${row.total} total`,
  }));
  return <Podium spots={spots} />;
}

function PeopleRows({ rows, showMe }: { rows: BoardRow[]; showMe: boolean }) {
  const tied = tiedRanks(rows);
  const { rest } = splitPodium(rows);
  if (rest.length === 0) return null;
  return (
    <Panel flush label="No. · member" action={<span className="hud-label pr-1">Kudos given</span>}>
      <ol className="flex flex-col">
        {rest.map((row, i) => {
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
      <MemberFace name={row.name} me={row.me} size={32} />
      <span className="truncate font-medium">{row.name}</span>
      {row.me && <Tag variant="info">You</Tag>}
    </Line>
  );
}

function GroupRows({ rows }: { rows: GroupRow[] }) {
  const tied = tiedRanks(rows);
  const { rest } = splitPodium(rows);
  if (rest.length === 0) return null;
  return (
    <Panel flush label="No. · group" action={<span className="hud-label pr-1">Per person</span>}>
      <ol className="flex flex-col">
        {rest.map((row, i) =>
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
    <>
      <GroupCrest group={row.group} mine={row.mine} size={30} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{row.group}</span>
          {row.mine && <Tag variant="info">Your group</Tag>}
        </span>
        <span className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
          <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border" role="img" aria-label={`${row.participation}% gave`}>
            <span className="block h-full rounded-full bg-foreground/50" style={{ width: `${row.participation}%` }} />
          </span>
          {row.participation}% gave · {row.total} total
        </span>
      </span>
    </>
  );
}

function Line({ rank, tie, highlight, value, children }: { rank: number; tie: boolean; highlight?: boolean; value: ReactNode; children: ReactNode }) {
  return (
    <li className={`grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 border-t px-3 py-2.5 ${highlight ? "bg-fill-selected shadow-[inset_3px_0_0_var(--primary)]" : ""}`}>
      <span className="flex items-baseline gap-0.5 leading-none text-muted-foreground" aria-label={`Rank ${rank}${tie ? ", tied" : ""}`}>
        <span className="hud-display text-2xl font-bold tabular-nums">{String(rank).padStart(2, "0")}</span>
        {tie && <span className="text-xs">=</span>}
      </span>
      <span className="flex min-w-0 items-center gap-2.5 text-sm">{children}</span>
      <span className="hud-display text-right text-xl font-bold tabular-nums leading-none">{value}</span>
    </li>
  );
}

function GapLine() {
  return (
    <li className="flex items-center gap-3 border-t px-3 py-1.5" aria-label="Skipped positions">
      <span className="h-px flex-1 border-t border-dashed" />
      <span className="hud-label">· · ·</span>
      <span className="h-px flex-1 border-t border-dashed" />
    </li>
  );
}

function HiddenLine() {
  return (
    <li className="flex items-center gap-3 border-t bg-fill-selected px-3 py-3 text-sm text-muted-foreground shadow-[inset_3px_0_0_var(--primary)]">
      <HiddenFace size={32} />
      You're off the board by choice. Switch on “Show me on the leaderboards” to come back.
    </li>
  );
}

function PrivateNotes({ board, facts }: { board: Board; facts: Boards }) {
  const lines = board === "groups" ? [facts.groups.myGroupLine && `${me.primaryGroup.name}: ${facts.groups.myGroupLine}`] : board === "everyone" ? [facts.everyone.improvementLine, facts.everyone.peerLine] : [];
  const shown = lines.filter((l): l is string => Boolean(l));
  const improved = board === "groups" ? facts.groups.mostImproved : undefined;
  if (shown.length === 0 && !improved) return null;
  return (
    <Panel
      label={
        <>
          <IconLock className="size-3" /> Only you see these
        </>
      }
      bodyClassName="flex flex-col gap-3 text-sm"
    >
      {improved && (
        <div className="flex items-center gap-3 rounded-lg border bg-background p-2.5 dark:bg-muted/40">
          <GroupCrest group={improved} size={36} />
          <span className="min-w-0">
            <span className="hud-label flex items-center gap-1">
              <IconTrending className="size-3" /> Most improved
            </span>
            <span className="block truncate font-semibold">{improved}</span>
          </span>
        </div>
      )}
      {shown.map((line) => (
        <p key={line} className="border-l-2 border-primary/60 pl-3 leading-relaxed">
          {line}
        </p>
      ))}
    </Panel>
  );
}
