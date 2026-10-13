// PROTOTYPE leaderboard as `hedgehug leaderboard` output: flags pick the board and period, rows carry ASCII bars, kudos given only.
import { useState } from "react";
import { Switch } from "@posthog/quill";
import { IconLock } from "@posthog/icons";
import { boards, me } from "../../data/mock";
import type { BoardRow, GroupRow, Period } from "../../data/types";
import { Bar, Comment, Echo, Flag, LinkText, useTerminal } from "./term";

type Board = "groups" | "my-group" | "everyone";
type PersonRow = Extract<BoardRow, { kind: "row" }>;
type TeamRow = Extract<GroupRow, { kind: "row" }>;

const boardFlags: Array<[Board, string]> = [
  ["groups", "--groups"],
  ["my-group", "--my-group"],
  ["everyone", "--everyone"],
];

const periodFlags: Array<[Period, string]> = [
  ["week", "--week"],
  ["month", "--month"],
  ["all", "--all"],
];

const isBoard = (s: string): s is Board => boardFlags.some(([id]) => id === s);
const isPeriod = (s: string): s is Period => periodFlags.some(([id]) => id === s);

const fromParam = (param?: string) => {
  const parts = param?.split(".") ?? [];
  return { board: parts.find(isBoard) ?? "everyone", period: parts.find(isPeriod) ?? "week" };
};

export function TerminalLeaderboard({ param }: { param?: string }) {
  useTerminal();
  const initial = fromParam(param);
  const [board, setBoard] = useState<Board>(initial.board);
  const [period, setPeriod] = useState<Period>(initial.period);
  const [showMe, setShowMe] = useState(me.privacy.showOnLeaderboards);
  const facts = boards[period];

  return (
    <div className="hh-in flex flex-col gap-4">
      <Echo command={`hedgehug leaderboard --${period} --${board}`}>kudos given only</Echo>

      <div className="flex flex-col gap-2">
        <FlagRow label="board">
          {boardFlags.map(([id, label]) => (
            <Flag key={id} on={board === id} onClick={() => setBoard(id)} title={id === "my-group" ? me.primaryGroup.name : undefined}>
              {label}
            </Flag>
          ))}
        </FlagRow>
        <FlagRow label="period">
          {periodFlags.map(([id, label]) => (
            <Flag key={id} on={period === id} onClick={() => setPeriod(id)}>
              {label}
            </Flag>
          ))}
        </FlagRow>
        <FlagRow label="me">
          <label className="flex cursor-pointer items-center gap-2">
            <Switch size="sm" checked={showMe} onCheckedChange={setShowMe} />
            <span className={showMe ? "font-semibold" : "text-muted-foreground"}>--show-me</span>
            <span className="text-xs text-muted-foreground">{showMe ? "on: you're listed" : "off: you're hidden everywhere"}</span>
          </label>
        </FlagRow>
      </div>

      <div className="max-w-3xl">
        {board === "groups" ? <GroupsBoard rows={facts.groups.rows} onOpenMine={() => setBoard("my-group")} /> : <PeopleBoard rows={board === "my-group" ? facts.myGroup.rows : facts.everyone.rows} showMe={showMe} onShowMe={() => setShowMe(true)} />}
      </div>

      {board === "groups" && <PrivateLines note="groups are scored per person, so a small group can top the board." lines={[facts.groups.myGroupLine && `${me.primaryGroup.name}: ${facts.groups.myGroupLine}`, facts.groups.mostImproved && `most improved: ${facts.groups.mostImproved}`]} />}
      {board === "my-group" && <Comment className="text-xs">{me.primaryGroup.name}, your primary group.</Comment>}
      {board === "everyone" && <PrivateLines lines={[facts.everyone.improvementLine, facts.everyone.peerLine]} />}

      <Comment className="text-xs">ranks by kudos given only. kudos received, XP, levels, coins and achievements never rank anyone.</Comment>
    </div>
  );
}

function FlagRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-14 text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

const rankText = (rows: Array<PersonRow | TeamRow>, rank: number) => `${rank}${rows.filter((r) => r.rank === rank).length > 1 ? "=" : ""}`;

function PeopleBoard({ rows, showMe, onShowMe }: { rows: BoardRow[]; showMe: boolean; onShowMe: () => void }) {
  const people = rows.filter((r): r is PersonRow => r.kind === "row");
  const max = Math.max(...people.map((r) => r.kudos));
  const grid = "grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-baseline gap-x-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_2.5rem_minmax(0,9rem)]";
  return (
    <ol aria-label="Members by kudos given" className="flex flex-col">
      <li className={`${grid} border-b pb-1 text-xs text-muted-foreground`}>
        <span>#</span>
        <span>member</span>
        <span className="text-right">given</span>
        <span className="hidden sm:inline" />
      </li>
      {rows.map((row, i) => {
        if (row.kind === "gap") return <GapLine key={`gap-${i}`} before={rows[i - 1]} after={rows[i + 1]} />;
        if (row.me && !showMe)
          return (
            <li key="me" className={`${grid} py-0.5 text-muted-foreground`}>
              <span>·</span>
              <span className="col-span-2 sm:col-span-3">
                › you, hidden. <LinkText onClick={onShowMe}>--show-me</LinkText> is off.
              </span>
            </li>
          );
        return (
          <li key={row.position} className={`${grid} py-0.5 ${row.me ? "bg-fill-selected font-semibold" : ""}`}>
            <span className={`tabular-nums ${row.rank <= 3 ? "font-semibold" : "text-muted-foreground"}`}>{rankText(people, row.rank)}</span>
            <LinkText href={row.me ? "#/profile" : "#/stickers"} className="min-w-0 truncate text-left decoration-transparent hover:decoration-current">
              {row.me && <span className="mr-1 text-primary">›</span>}
              {row.name}
              {row.me && <span className="ml-1 text-xs text-primary">(you)</span>}
            </LinkText>
            <span className="text-right tabular-nums">{row.kudos}</span>
            <Bar value={row.kudos} max={max} width={12} tone={row.me ? "text-primary" : "text-muted-foreground"} className="hidden sm:inline" />
          </li>
        );
      })}
    </ol>
  );
}

function GroupsBoard({ rows, onOpenMine }: { rows: GroupRow[]; onOpenMine: () => void }) {
  const teams = rows.filter((r): r is TeamRow => r.kind === "row");
  const max = Math.max(...teams.map((r) => r.score));
  const grid = "grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem_3.5rem] items-baseline gap-x-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_4.5rem_3.5rem_3rem_minmax(0,8rem)]";
  return (
    <ol aria-label="Groups by kudos given per person" className="flex flex-col">
      <li className={`${grid} border-b pb-1 text-xs text-muted-foreground`}>
        <span>#</span>
        <span>group</span>
        <span className="text-right">per head</span>
        <span className="text-right">% gave</span>
        <span className="hidden text-right sm:inline">total</span>
        <span className="hidden sm:inline" />
      </li>
      {rows.map((row, i) => {
        if (row.kind === "gap") return <GapLine key={`gap-${i}`} before={rows[i - 1]} after={rows[i + 1]} />;
        return (
          <li key={row.group} className={`${grid} py-0.5 ${row.mine ? "bg-fill-selected font-semibold" : ""}`}>
            <span className={`tabular-nums ${row.rank <= 3 ? "font-semibold" : "text-muted-foreground"}`}>{rankText(teams, row.rank)}</span>
            {row.mine ? (
              <LinkText onClick={onOpenMine} className="min-w-0 truncate text-left decoration-transparent hover:decoration-current">
                <span className="mr-1 text-primary">›</span>
                {row.group}
                <span className="ml-1 text-xs text-primary">(yours)</span>
              </LinkText>
            ) : (
              <span className="min-w-0 truncate">{row.group}</span>
            )}
            <span className="text-right tabular-nums">{row.score.toFixed(1)}</span>
            <span className="text-right tabular-nums">{row.participation}%</span>
            <span className="hidden text-right tabular-nums sm:inline">{row.total}</span>
            <Bar value={row.score} max={max} width={10} tone={row.mine ? "text-primary" : "text-muted-foreground"} className="hidden sm:inline" />
          </li>
        );
      })}
    </ol>
  );
}

function GapLine({ before, after }: { before?: BoardRow | GroupRow; after?: BoardRow | GroupRow }) {
  const from = before?.kind === "row" ? before.position + 1 : undefined;
  const to = after?.kind === "row" ? after.position - 1 : undefined;
  return (
    <li aria-label="Skipped positions" className="flex items-baseline gap-3 py-0.5 text-xs text-muted-foreground">
      <span className="w-10">⋮</span>
      <span>
        {from !== undefined && to !== undefined ? `positions ${from}–${to} skipped` : "positions skipped"}
      </span>
    </li>
  );
}

function PrivateLines({ lines, note }: { lines: Array<string | undefined>; note?: string }) {
  const shown = lines.filter((l): l is string => Boolean(l));
  if (shown.length === 0 && !note) return null;
  return (
    <div className="flex flex-col text-xs">
      {note && <Comment>{note}</Comment>}
      {shown.length > 0 && (
        <>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <IconLock className="size-3.5" /> only you see these:
          </span>
          {shown.map((line) => (
            <Comment key={line} className="pl-5">
              {line}
            </Comment>
          ))}
        </>
      )}
    </div>
  );
}
