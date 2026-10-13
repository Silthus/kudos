// Variant E workday streak: A's heatmap of the last four weeks, recoloured in E's primary and set in a HUD panel.
import { IconLock } from "@posthog/icons";
import { me } from "../../data/mock";
import { workdayHeatmap, type WorkdayCell } from "../a/series";
import { Panel } from "./hud";

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export function StreakPanel() {
  return (
    <Panel
      label="Workday streak"
      action={
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <IconLock className="size-3" /> Only you
        </span>
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex shrink-0 items-baseline gap-2 sm:flex-col sm:gap-0.5">
          <span className="hud-display text-4xl font-bold leading-none tabular-nums">{me.streak.days}</span>
          <span className="text-sm text-muted-foreground">workdays in a row</span>
          <span className="text-xs text-muted-foreground sm:mt-1">
            Best {me.streak.best} · {me.streak.freezesHeld} freeze held
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <Heatmap weeks={workdayHeatmap} />
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-[3px] bg-primary" /> Gave kudos
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-[3px] bg-muted ring-1 ring-inset ring-border" /> Missed
            </span>
            <span className="flex items-center gap-1">
              <span className="text-[10px]">❄</span> Freeze used
            </span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Heatmap({ weeks }: { weeks: WorkdayCell[][] }) {
  const peak = Math.max(...weeks.flat().map((c) => c.kudos), 1);
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `3.75rem repeat(${dayNames.length}, minmax(0, 1fr))` }}>
      <span />
      {dayNames.map((d) => (
        <span key={d} className="text-center text-[10px] text-muted-foreground">
          {d}
        </span>
      ))}
      {weeks.map((week, wi) => (
        <div key={wi} className="contents">
          <span className="self-center whitespace-nowrap text-[10px] text-muted-foreground">{wi === weeks.length - 1 ? "This week" : `${weeks.length - 1 - wi} wk ago`}</span>
          {week.map((cell) => (
            <Cell key={cell.label} cell={cell} peak={peak} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Cell({ cell, peak }: { cell: WorkdayCell; peak: number }) {
  const title = `${cell.label}: ${cell.state === "freeze" ? "streak freeze" : cell.state === "future" ? "not yet" : `${cell.kudos} kudos`}`;
  if (cell.state === "future") return <div title={title} className="h-7 rounded-[5px] border border-dashed opacity-60" />;
  if (cell.state === "freeze")
    return (
      <div title={title} className="flex h-7 items-center justify-center rounded-[5px] border border-dashed border-info-foreground/50 bg-info text-[11px] text-info-foreground">
        ❄
      </div>
    );
  if (cell.kudos === 0) return <div title={title} className="h-7 rounded-[5px] bg-muted ring-1 ring-inset ring-border" />;
  const strength = 35 + (cell.kudos / peak) * 65;
  return (
    <div title={title} className={`flex h-7 items-center justify-center rounded-[5px] text-[10px] font-semibold tabular-nums ${strength > 60 ? "text-primary-foreground" : "text-foreground"}`} style={{ background: `color-mix(in oklab, var(--primary) ${strength}%, var(--muted))` }}>
      {cell.kudos}
    </div>
  );
}
