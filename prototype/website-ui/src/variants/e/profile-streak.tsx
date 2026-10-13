// Variant E workday streak in the profile rail: a quiet contribution-graph calendar of the last thirteen workweeks in neutral steps, with only the live streak in the accent colour.
import type { CSSProperties } from "react";
import { IconLock } from "@posthog/icons";
import { me } from "../../data/mock";
import { Panel } from "./hud";

type DayState = "gave" | "missed" | "freeze" | "future";
type Day = { date: Date; kudos: number; state: DayState; inStreak: boolean; today: boolean };

const weekCount = 13;
const today = new Date(2026, 9, 13);
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const freezeDays = new Set([17, 44]);
const longestEarlierRun = me.streak.best - 1;

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const noise = (i: number) => (Math.imul(i + 7, 2654435761) >>> 0) % 100;
const kudosFromNoise = (n: number) => (n < 22 ? 0 : n < 52 ? 1 : n < 76 ? 2 : n < 92 ? 3 : 6);

const weeks: Day[][] = (() => {
  const weekday = (today.getDay() + 6) % 7;
  const firstMonday = addDays(today, -weekday - 7 * (weekCount - 1));
  const todayIndex = (weekCount - 1) * 5 + weekday;
  const streakStart = todayIndex - me.streak.days + 1;
  const days: Day[] = [];
  let run = 0;
  for (let i = 0; i < weekCount * 5; i++) {
    const date = addDays(firstMonday, Math.floor(i / 5) * 7 + (i % 5));
    const inStreak = i >= streakStart && i <= todayIndex;
    const day = (kudos: number, state: DayState): Day => ({ date, kudos, state, inStreak, today: i === todayIndex });
    if (i > todayIndex) days.push(day(0, "future"));
    else if (inStreak) days.push(day(Math.max(1, kudosFromNoise(noise(i))), "gave"));
    else if (freezeDays.has(i)) days.push(day(0, "freeze"));
    else {
      const kudos = i === streakStart - 1 || run >= longestEarlierRun ? 0 : kudosFromNoise(noise(i));
      run = kudos > 0 ? run + 1 : 0;
      days.push(day(kudos, kudos > 0 ? "gave" : "missed"));
    }
  }
  return Array.from({ length: weekCount }, (_, w) => days.slice(w * 5, w * 5 + 5));
})();

const intensity = (kudos: number) => (kudos <= 0 ? 0 : kudos === 1 ? 1 : kudos === 2 ? 2 : kudos <= 4 ? 3 : 4);
const neutralShades = [6, 16, 28, 44, 66];
const streakShades = [0, 72, 82, 92, 100];

const fill = (level: number, accent = false): CSSProperties => ({
  background: accent ? `color-mix(in oklab, var(--primary) ${streakShades[level]}%, var(--card))` : `color-mix(in oklab, var(--foreground) ${neutralShades[level]}%, transparent)`,
});

const freezeFill: CSSProperties = {
  background: `repeating-linear-gradient(135deg, color-mix(in oklab, var(--foreground) 34%, transparent) 0 1.5px, color-mix(in oklab, var(--foreground) 7%, transparent) 1.5px 4px)`,
};

const todayMark: CSSProperties = { outline: "1.5px solid color-mix(in oklab, var(--foreground) 60%, transparent)", outlineOffset: "1.5px" };

const formatDate = (d: Date) => `${weekdayNames[(d.getDay() + 6) % 7]}, ${monthNames[d.getMonth()]} ${d.getDate()}`;

function dayTitle(day: Day) {
  const what = day.state === "freeze" ? "streak freeze used" : day.kudos === 0 ? "no kudos given" : `${day.kudos} kudos given`;
  return `${formatDate(day.date)}${day.today ? " (today)" : ""}: ${what}`;
}

function monthLabelAt(w: number) {
  const month = weeks[w][0].date.getMonth();
  if (w === 0) return weeks.slice(1, 3).every((week) => week[0].date.getMonth() === month) ? monthNames[month] : undefined;
  return month !== weeks[w - 1][0].date.getMonth() ? monthNames[month] : undefined;
}

export function StreakPanel() {
  return (
    <Panel
      label="Workday streak"
      action={
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <IconLock className="size-3" /> Only you see this
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <StreakFacts />
        <Calendar />
        <Legend />
      </div>
    </Panel>
  );
}

function StreakFacts() {
  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
      <div className="flex items-baseline gap-2">
        <span className="hud-display text-4xl font-bold leading-none tabular-nums">{me.streak.days}</span>
        <span className="text-sm text-muted-foreground">workdays in a row</span>
      </div>
      <div className="ml-auto flex gap-5">
        <Fact value={me.streak.best} label="Best" />
        <Fact value={me.streak.freezesHeld} label={me.streak.freezesHeld === 1 ? "Freeze held" : "Freezes held"} />
      </div>
    </div>
  );
}

function Fact({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-lg font-semibold leading-none tabular-nums">{value}</span>
      <span className="hud-label whitespace-nowrap">{label}</span>
    </div>
  );
}

function Calendar() {
  return (
    <div
      role="img"
      aria-label={`Workdays over the last ${weekCount} weeks. Current streak ${me.streak.days} workdays.`}
      className="grid w-full gap-[3px]"
      style={{ gridTemplateColumns: `auto repeat(${weekCount}, minmax(0, 1fr))` }}
    >
      {weeks.map((_, w) => {
        const label = monthLabelAt(w);
        return (
          label && (
            <span key={`m${w}`} className="whitespace-nowrap pb-0.5 text-[10px] leading-none text-muted-foreground" style={{ gridColumn: `${w + 2} / span 3`, gridRow: 1 }}>
              {label}
            </span>
          )
        );
      })}
      {weekdayNames.map((name, d) => (
        <span key={name} className="self-center pr-1.5 text-[10px] leading-none text-muted-foreground" style={{ gridColumn: 1, gridRow: d + 2 }}>
          {d % 2 === 0 ? name : ""}
        </span>
      ))}
      {weeks.map((week, w) => week.map((day, d) => <Cell key={`${w}-${d}`} day={day} column={w + 2} row={d + 2} />))}
    </div>
  );
}

function Cell({ day, column, row }: { day: Day; column: number; row: number }) {
  const place: CSSProperties = { gridColumn: column, gridRow: row };
  if (day.state === "future") return <span aria-hidden className="aspect-square" style={place} />;
  const look = day.state === "freeze" ? freezeFill : fill(intensity(day.kudos), day.inStreak);
  return <span title={dayTitle(day)} className="aspect-square rounded-[3px]" style={{ ...place, ...look, ...(day.today ? todayMark : {}) }} />;
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={fill(3, true)} /> This streak
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={freezeFill} /> Freeze used
        </span>
      </div>
      <div className="flex items-center gap-1" aria-label="Fewer to more kudos given">
        Less
        {neutralShades.map((_, level) => (
          <span key={level} className="size-2.5 rounded-[3px]" style={fill(level)} />
        ))}
        More
      </div>
    </div>
  );
}
