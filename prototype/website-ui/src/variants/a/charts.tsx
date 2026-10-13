// PROTOTYPE hand-built SVG/HTML charts in PostHog's insight shapes, coloured with Quill's data tokens.
import { useEffect, useRef, useState, type ReactNode } from "react";

export const series = (n: number) => `var(--data-color-${n})`;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const niceTicks = (min: number, max: number, count: number) => {
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max; v += step) ticks.push(v);
  return ticks;
};

type TrendPoint = { label: string; value: number };
type TrendProps = {
  points: TrendPoint[];
  annotation?: { index: number; label: string };
  goal?: { value: number; label: string };
  unit?: string;
  color?: string;
  height?: number;
};

export function TrendLine({ points, annotation, goal, unit = "", color = series(1), height = 220 }: TrendProps) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number>();
  const w = Math.max(width, 280);
  const pad = { l: 46, r: 16, t: 30, b: 26 };
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values, goal?.value ?? 0);
  const span = hi - lo || 1;
  const yMin = lo - span * 0.08;
  const yMax = hi + span * 0.08;
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / Math.max(points.length - 1, 1);
  const y = (v: number) => pad.t + ((yMax - v) / (yMax - yMin)) * (height - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(height - pad.b).toFixed(1)} L${x(0).toFixed(1)},${(height - pad.b).toFixed(1)} Z`;
  const ticks = niceTicks(yMin, yMax, 4);
  const xLabels = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const gradientId = `trend-${color.replace(/[^a-z0-9]/gi, "")}`;
  const pick = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left;
    const i = Math.round(((px - pad.l) / (w - pad.l - pad.r)) * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  };
  const hovered = hover !== undefined ? points[hover] : undefined;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <>
          <svg width={w} height={height} className="block" onMouseLeave={() => setHover(undefined)} onMouseMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())} onTouchMove={(e) => pick(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                <stop offset="100%" stopColor={color} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-graph-axis-line)" strokeDasharray="2 3" />
                <text x={pad.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--color-graph-axis-label)" className="tabular-nums">
                  {t.toLocaleString()}
                </text>
              </g>
            ))}
            {xLabels.map((i) => (
              <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize="10" fill="var(--color-graph-axis-label)">
                {points[i].label}
              </text>
            ))}
            {goal && (
              <g>
                <line x1={pad.l} x2={w - pad.r} y1={y(goal.value)} y2={y(goal.value)} stroke="var(--color-graph-crosshair)" strokeDasharray="6 4" strokeOpacity="0.7" />
                <text x={w - pad.r} y={y(goal.value) - 6} textAnchor="end" fontSize="10" fontWeight="600" fill="var(--color-graph-axis-label)">
                  {goal.label}
                </text>
              </g>
            )}
            <path d={area} fill={`url(#${gradientId})`} />
            <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {annotation && (
              <g>
                <line x1={x(annotation.index)} x2={x(annotation.index)} y1={pad.t - 6} y2={height - pad.b} stroke={series(4)} strokeDasharray="3 3" />
                <circle cx={x(annotation.index)} cy={y(points[annotation.index].value)} r="4.5" fill="var(--card)" stroke={series(4)} strokeWidth="2" />
              </g>
            )}
            {hovered && hover !== undefined && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="var(--color-graph-crosshair)" strokeOpacity="0.5" />
                <circle cx={x(hover)} cy={y(hovered.value)} r="4" fill={color} stroke="var(--card)" strokeWidth="2" />
              </g>
            )}
            <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].value)} r="3.5" fill={color} />
          </svg>
          {annotation && (
            <span
              className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ left: x(annotation.index), background: series(4) }}
            >
              {annotation.label}
            </span>
          )}
          {hovered && hover !== undefined && (
            <div
              className="pointer-events-none absolute z-10 rounded-md border bg-card px-2 py-1 text-xs shadow-md"
              style={{ left: Math.min(Math.max(x(hover) - 50, 0), w - 110), top: Math.max(y(hovered.value) - 44, 0) }}
            >
              <div className="text-muted-foreground">{hovered.label}</div>
              <div className="font-semibold tabular-nums">
                {hovered.value.toLocaleString()}
                {unit}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

type FunnelStep = { label: string; value: number; sub: string; state: "done" | "current" | "ahead" };

export function Funnel({ steps, max }: { steps: FunnelStep[]; max: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => {
        const pct = Math.max(0.04, s.value / max);
        return (
          <div key={s.label} className="flex min-w-0 flex-col gap-1.5">
            <div className="relative h-24 rounded-md bg-muted">
              <div
                className={`absolute inset-x-0 bottom-0 rounded-md ${s.state === "ahead" ? "border-2 border-dashed" : ""}`}
                style={{
                  height: `${pct * 100}%`,
                  background: s.state === "ahead" ? "transparent" : s.state === "current" ? series(1) : `color-mix(in oklab, ${series(1)} 55%, var(--muted))`,
                  borderColor: s.state === "ahead" ? "var(--color-graph-crosshair)" : undefined,
                }}
              />
              {i > 0 && <span className="absolute -left-2 top-1 text-[10px] text-muted-foreground">→</span>}
            </div>
            <div className="truncate text-xs font-medium">{s.label}</div>
            <div className="truncate text-[11px] text-muted-foreground tabular-nums">{s.sub}</div>
          </div>
        );
      })}
    </div>
  );
}

type HeatCell = { label: string; kudos: number; state: "gave" | "missed" | "freeze" | "future" };

export function Heatmap({ weeks, dayNames }: { weeks: HeatCell[][]; dayNames: string[] }) {
  const peak = Math.max(...weeks.flat().map((c) => c.kudos), 1);
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `3.5rem repeat(${dayNames.length}, minmax(0, 1fr))` }}>
      <span />
      {dayNames.map((d) => (
        <span key={d} className="text-center text-[10px] text-muted-foreground">
          {d}
        </span>
      ))}
      {weeks.map((week, wi) => (
        <div key={wi} className="contents">
          <span className="self-center text-[10px] text-muted-foreground">{wi === weeks.length - 1 ? "This week" : `${weeks.length - 1 - wi} wk ago`}</span>
          {week.map((cell) => (
            <div
              key={cell.label}
              title={`${cell.label}: ${cell.state === "freeze" ? "streak freeze" : cell.state === "future" ? "not yet" : `${cell.kudos} kudos`}`}
              className={`flex h-7 items-center justify-center rounded-[4px] text-[10px] font-semibold ${cell.state === "freeze" ? "border border-dashed text-muted-foreground" : cell.state === "future" ? "border border-dashed opacity-50" : cell.kudos > 0 ? "text-white" : "text-muted-foreground"}`}
              style={{ background: cell.kudos > 0 ? `color-mix(in oklab, ${series(1)} ${25 + (cell.kudos / peak) * 75}%, var(--muted))` : cell.state === "future" ? "transparent" : "var(--muted)" }}
            >
              {cell.state === "freeze" ? "❄" : cell.kudos > 0 ? cell.kudos : ""}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function GroupedBars({ groups, legend }: { groups: Array<{ label: string; values: number[] }>; legend: Array<{ name: string; color: string; locked?: boolean }> }) {
  const peak = Math.max(...groups.flatMap((g) => g.values), 1);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        {groups.map((g) => (
          <div key={g.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-28 w-full items-end justify-center gap-0.5">
              {g.values.map((v, i) => (
                <div key={i} title={`${g.label} · ${legend[i].name}: ${v}`} className="w-full max-w-4 rounded-t-[3px]" style={{ height: `${(v / peak) * 100}%`, background: legend[i].color, opacity: legend[i].locked ? 0.45 : 1 }} />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">{g.label}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {legend.map((l) => (
          <span key={l.name} className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-[2px]" style={{ background: l.color, opacity: l.locked ? 0.45 : 1 }} />
            {l.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Bar({ value, max, color = series(1), children }: { value: number; max: number; color?: string; children?: ReactNode }) {
  return (
    <div className="relative h-5 w-full overflow-hidden rounded-[3px] bg-muted">
      <div className="h-full rounded-[3px] transition-[width] duration-500" style={{ width: `${Math.max(2, (value / max) * 100)}%`, background: color }} />
      {children}
    </div>
  );
}
