// Zine leaderboard: a newspaper front page whose headline names the leader, with the board set below in editorial rules.
import { useState, type ReactNode } from "react";
import { Label, Switch } from "@posthog/quill";
import { HedgehogTownCrier } from "@posthog/brand/hoggies";
import { IconLock } from "@posthog/icons";
import { boards, me } from "../../data/mock";
import type { BoardRow, GroupRow, Period } from "../../data/types";
import { Initials } from "../../ui";
import { Display, Kicker } from "./zine";

type PersonRow = Extract<BoardRow, { kind: "row" }>;
type TeamRow = Extract<GroupRow, { kind: "row" }>;
type Edition = "groups" | "myGroup" | "everyone";

const periods: Array<{ id: Period; label: string; phrase: string }> = [
  { id: "week", label: "This week", phrase: "the week" },
  { id: "month", label: "This month", phrase: "the month" },
  { id: "all", label: "All time", phrase: "all time" },
];

const highlighter = { background: "#FFCE1C", color: "#141414" };

export function ZineLeaderboard(_props: { param?: string }) {
  const [period, setPeriod] = useState<Period>("week");
  const [edition, setEdition] = useState<Edition>("everyone");
  const [showMe, setShowMe] = useState(me.privacy.showOnLeaderboards);
  const facts = boards[period];
  const phrase = periods.find((p) => p.id === period)?.phrase ?? "";
  const editions: Array<{ id: Edition; label: string }> = [
    { id: "groups", label: "Groups" },
    { id: "myGroup", label: me.primaryGroup.name },
    { id: "everyone", label: "Everyone" },
  ];
  const story = edition === "groups" ? groupStory(facts.groups.rows, phrase) : peopleStory(edition === "myGroup" ? facts.myGroup.rows : facts.everyone.rows, phrase, showMe);

  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-4 border-b-2 border-foreground pb-4">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <Kicker className="text-muted-foreground">The front page · kudos given only</Kicker>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <div className="flex gap-4" role="group" aria-label="Period">
              {periods.map((p) => (
                <TextToggle key={p.id} pressed={p.id === period} onClick={() => setPeriod(p.id)}>
                  {p.label}
                </TextToggle>
              ))}
            </div>
            <Label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch size="sm" checked={showMe} onCheckedChange={setShowMe} />
              Show me on the leaderboards
            </Label>
          </div>
        </div>
        <div className="flex gap-6 overflow-x-auto" role="tablist" aria-label="Edition">
          {editions.map((e) => (
            <button
              key={e.id}
              role="tab"
              aria-selected={e.id === edition}
              onClick={() => setEdition(e.id)}
              className={`shrink-0 border-b-[3px] pb-1 text-sm ${e.id === edition ? "border-foreground font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {e.label}
            </button>
          ))}
        </div>
      </header>

      <section className="grid items-end gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <Display as="h1" className="text-[clamp(2.75rem,8vw,6.5rem)]">
            {story.headline}
          </Display>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {story.deck} Only kudos given count here. Kudos received, XP, levels, coins and achievements never rank anyone.
          </p>
        </div>
        <HedgehogTownCrier size={220} title="A hedgehog town crier" className="hidden h-auto w-40 justify-self-end md:block md:w-52" />
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        {edition === "groups" ? <GroupsBoard rows={facts.groups.rows} /> : <PeopleBoard rows={edition === "myGroup" ? facts.myGroup.rows : facts.everyone.rows} showMe={showMe} />}
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
    </article>
  );
}

function groupStory(rows: GroupRow[], phrase: string) {
  const ranked = rows.filter((r): r is TeamRow => r.kind === "row");
  const leaders = ranked.filter((r) => r.rank === 1);
  const headline = leaders.length > 1 ? `${joinNames(leaders.map((l) => l.group))} share the lead.` : `${leaders[0]?.group} leads ${phrase}.`;
  const mine = ranked.find((r) => r.mine);
  const deck = `${leaders[0]?.score.toFixed(1)} kudos given per person, ${leaders[0]?.participation}% of them gave.${mine ? ` ${mine.group} sits at No. ${mine.rank}.` : ""}`;
  return { headline, deck };
}

function peopleStory(rows: BoardRow[], phrase: string, showMe: boolean) {
  const ranked = rows.filter((r): r is PersonRow => r.kind === "row");
  const leaders = ranked.filter((r) => r.rank === 1);
  const name = (r: PersonRow) => (r.me ? "You" : r.name);
  const headline = leaders.length > 1 ? `${joinNames(leaders.map(name))} share the lead.` : leaders[0]?.me ? `You lead ${phrase}.` : `${leaders[0]?.name} leads ${phrase}.`;
  const mine = ranked.find((r) => r.me);
  const tied = mine ? ranked.filter((r) => r.rank === mine.rank && !r.me) : [];
  const yours = mine && mine.rank > 1 ? ` You sit at No. ${mine.rank} with ${mine.kudos}${tied.length > 0 ? `, tied with ${joinNames(tied.map((t) => t.name))}` : ""}.` : "";
  const deck = `${leaders[0]?.kudos} kudos given.${showMe ? yours : " You're off the board by choice."}`;
  return { headline, deck };
}

const joinNames = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

function TextToggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={`text-sm ${pressed ? "font-semibold underline decoration-2 underline-offset-[6px]" : "text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}

function PeopleBoard({ rows, showMe }: { rows: BoardRow[]; showMe: boolean }) {
  return (
    <ol className="border-t-2 border-foreground">
      <li className="grid grid-cols-[3.5rem_1fr_auto] gap-3 border-b border-foreground/20 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <span>No.</span>
        <span>Member</span>
        <span className="text-right">Kudos given</span>
      </li>
      {rows.map((row, i) => {
        if (row.kind === "gap") return <GapRow key={`gap-${i}`} before={rows[i - 1]} after={rows[i + 1]} />;
        if (row.me && !showMe) return <HiddenRow key="me" />;
        return <PersonLine key={row.position} row={row} />;
      })}
    </ol>
  );
}

function PersonLine({ row }: { row: PersonRow }) {
  return (
    <li className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 border-b border-foreground/20 py-3">
      <Rank rank={row.rank} />
      <span className="flex min-w-0 items-center gap-3">
        <Initials name={row.name} size={32} />
        <span className="truncate font-medium">
          <span className={row.me ? "px-1.5" : ""} style={row.me ? highlighter : undefined}>
            {row.me ? `${row.name}, that's you` : row.name}
          </span>
        </span>
      </span>
      <span className="text-right">
        <span className="text-xl font-semibold tabular-nums">{row.kudos}</span>
      </span>
    </li>
  );
}

function GroupsBoard({ rows }: { rows: GroupRow[] }) {
  return (
    <ol className="border-t-2 border-foreground">
      <li className="grid grid-cols-[3.5rem_1fr_5rem_4rem] gap-3 border-b border-foreground/20 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:grid-cols-[3.5rem_1fr_5rem_4rem_4rem]">
        <span>No.</span>
        <span>Group</span>
        <span className="text-right">Per person</span>
        <span className="text-right">% gave</span>
        <span className="hidden text-right sm:block">Total</span>
      </li>
      {rows.map((row, i) => (row.kind === "gap" ? <GapRow key={`gap-${i}`} before={rows[i - 1]} after={rows[i + 1]} /> : <TeamLine key={row.group} row={row} />))}
    </ol>
  );
}

function TeamLine({ row }: { row: TeamRow }) {
  return (
    <li className="grid grid-cols-[3.5rem_1fr_5rem_4rem] items-center gap-3 border-b border-foreground/20 py-3 sm:grid-cols-[3.5rem_1fr_5rem_4rem_4rem]">
      <Rank rank={row.rank} />
      <span className="min-w-0 truncate font-medium">
        <span className={row.mine ? "px-1.5" : ""} style={row.mine ? highlighter : undefined}>
          {row.mine ? `${row.group}, your group` : row.group}
        </span>
      </span>
      <span className="text-right text-xl font-semibold tabular-nums">{row.score.toFixed(1)}</span>
      <span className="text-right tabular-nums text-muted-foreground">{row.participation}%</span>
      <span className="hidden text-right tabular-nums text-muted-foreground sm:block">{row.total}</span>
    </li>
  );
}

function Rank({ rank }: { rank: number }) {
  return (
    <Display as="span" className="text-3xl tabular-nums">
      {String(rank).padStart(2, "0")}
    </Display>
  );
}

const positionOf = (row?: BoardRow | GroupRow) => (row && row.kind === "row" ? row.position : undefined);

function GapRow({ before, after }: { before?: BoardRow | GroupRow; after?: BoardRow | GroupRow }) {
  const from = positionOf(before);
  const to = positionOf(after);
  const skipped = from !== undefined && to !== undefined && to - from > 1 ? `positions ${from + 1} to ${to - 1}` : "skipped positions";
  return (
    <li aria-label="Skipped positions" className="flex items-center gap-3 border-b border-foreground/20 py-2 text-xs text-muted-foreground">
      <span className="w-[3.5rem] text-center tracking-[0.3em]">···</span>
      <span>{skipped}</span>
    </li>
  );
}

function HiddenRow() {
  return (
    <li className="border-b border-foreground/20 py-3 text-sm text-muted-foreground">
      <span style={highlighter} className="px-1.5 font-medium">
        You're off the board.
      </span>{" "}
      Change that in{" "}
      <a href="#/profile" className="text-foreground underline underline-offset-2">
        Settings
      </a>
      .
    </li>
  );
}

function EditorsNotes({ lines, note }: { lines: Array<string | undefined>; note?: string }) {
  const shown = lines.filter((l): l is string => Boolean(l));
  if (shown.length === 0 && !note) return null;
  return (
    <aside className="flex flex-col gap-3 border-t-2 border-foreground pt-3 text-sm">
      <Kicker className="text-muted-foreground">Editor's notes</Kicker>
      {note && <p className="text-muted-foreground">{note}</p>}
      {shown.length > 0 && (
        <>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]">
            <IconLock className="size-3.5" /> Only you see these
          </p>
          {shown.map((line) => (
            <p key={line} className="border-l-4 border-foreground/40 pl-3 leading-relaxed">
              {line}
            </p>
          ))}
        </>
      )}
    </aside>
  );
}
