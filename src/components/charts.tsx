import clsx from "clsx";
import { motion } from "motion/react";
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { teamSummary, type TeamDistribution } from "@/lib/compare";
import { dayLabel, nf } from "@/lib/format";
import { labelWidth, nudgeLabels } from "@/lib/labels";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(max: number) {
  if (max <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** Monotone cubic (Fritsch–Carlson) path: smooth, but never overshoots the data. */
export function monotonePath(points: [number, number][]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n < 3) return points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
  const dx = points.slice(1).map((p, i) => p[0] - points[i][0]);
  const slope = points.slice(1).map((p, i) => (p[1] - points[i][1]) / dx[i]);
  const tangent = points.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    return slope[i - 1] * slope[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / slope[i - 1] + (dx[i] + 2 * dx[i - 1]) / slope[i]);
  });
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const h = dx[i] / 3;
    d += `C${(x0 + h).toFixed(1)},${(y0 + h * tangent[i]).toFixed(1)} ${(x1 - h).toFixed(1)},${(y1 - h * tangent[i + 1]).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

export type Series = {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
  /** Stroke opacity; dashed series default to 0.55 so they recede when they share the solid series' colour. */
  opacity?: number;
  /** A per-point aside shown next to the label in the tooltip, e.g. the aligned previous-period date. */
  notes?: (string | null)[];
};

const seriesOpacity = (s: Series) => s.opacity ?? (s.dashed ? 0.55 : 1);

function lastIndex(values: (number | null)[]) {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null) return i;
  return -1;
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/75">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden>
            <line x1="1" x2="17" y1="4" y2="4" stroke={i.color} strokeWidth="2" strokeLinecap="square" strokeDasharray={i.dashed ? "3 3" : undefined} />
          </svg>
          {i.label}
        </span>
      ))}
    </div>
  );
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 90), width - 90);
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-40 -translate-x-1/2 -translate-y-full bg-parchment px-3 py-2 text-xs text-ink shadow-[inset_0_0_0_1px_var(--color-bark),2px_2px_0_0_var(--color-dusk-deep)]"
      style={{ left, top: y - 10 }}
    >
      {children}
    </div>
  );
}

/**
 * A square data marker (the pixel kit has no round dots): 8 px, centred on its point, with a 2 px
 * parchment ring so it stays legible where it overlaps a line. `stroke` draws a hollow marker.
 */
function Marker({ x, y, fill, stroke, size = 8, ring = true }: { x: number; y: number; fill: string; stroke?: string; size?: number; ring?: boolean }) {
  return (
    <rect
      data-marker
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      fill={fill}
      stroke={stroke ?? (ring ? "var(--color-parchment)" : "none")}
      strokeWidth={2}
      shapeRendering="crispEdges"
    />
  );
}

/**
 * Multi-series line chart over days: solid current period, dashed comparison. `endLabels` direct-labels
 * each line's last point ("You 23") and reserves a gutter on the right for them.
 */
export function LineChart({ days, series, height = 240, endLabels = false }: { days: string[]; series: Series[]; height?: number; endLabels?: boolean }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  // Direct labels at each line's last point; the right gutter is as wide as the widest one.
  const endInfo = endLabels
    ? series.flatMap((s) => {
        const i = lastIndex(s.values);
        const value = s.values[i] ?? 0;
        return i < 0 ? [] : [{ s, i, value, width: labelWidth(`${s.label} ${nf.format(value)}`) }];
      })
    : [];
  const labelRoom = Math.max(0, ...endInfo.map((e) => e.width));
  const pad = { top: 12, right: Math.max(12, labelRoom), bottom: 28, left: 32 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values.map((v) => v ?? 0))));
  const x = (i: number) => pad.left + (days.length <= 1 ? w / 2 : (i / (days.length - 1)) * w);
  const y = (v: number) => pad.top + h - (v / max) * h;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor(w / 70))));

  const paths = useMemo(
    () =>
      series.map((s) =>
        monotonePath(
          s.values.flatMap((v, i) => (v === null ? [] : [[x(i), y(v)] as [number, number]])),
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, width, max],
  );
  const first = series[0];
  const firstEnd = first ? lastIndex(first.values) : -1;
  const area = first && !first.dashed && width > 0 && firstEnd >= 0
    ? `${paths[0]}L${x(firstEnd)},${y(0)}L${x(0)},${y(0)}Z`
    : null;
  const ends = endInfo.map((e) => ({ ...e, x: x(e.i), y: y(e.value) }));
  const endYs = nudgeLabels(ends, { gap: 13, width: labelRoom });

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="overflow-visible" role="img" aria-label={`Chart of ${series.map((s) => s.label).join(", ")}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + w} y1={y(t)} y2={y(t)} stroke="var(--color-parchment-deep)" />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="fill-ink/65 tabular text-[10px]">
                {nf.format(t)}
              </text>
            </g>
          ))}
          {days.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d} x={x(i)} y={height - 8} textAnchor="middle" className="fill-ink/65 tabular text-[10px]">
                {dayLabel(d)}
              </text>
            ) : null,
          )}
          {area && <motion.path d={area} fill={first?.color} fillOpacity={0.12} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} />}
          {series.map((s, si) => (
            <motion.path
              key={s.key}
              d={paths[si]}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="square"
              strokeDasharray={s.dashed ? "4 4" : undefined}
              // Drawing a line in animates its dash array, which would erase a dashed series' dashes: fade those in.
              initial={s.dashed ? { opacity: 0 } : { pathLength: 0, opacity: seriesOpacity(s) }}
              animate={s.dashed ? { opacity: seriesOpacity(s) } : { pathLength: 1, opacity: seriesOpacity(s) }}
              transition={{ duration: s.dashed ? 0.6 : 1, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
          {ends.map((e, i) => (
            <g key={e.s.key}>
              <Marker x={e.x} y={e.y} fill={e.s.color} />
              <text
                x={e.x + 9}
                y={endYs[i] + 4}
                className="fill-ink text-[11px] font-medium"
                stroke="var(--color-parchment)"
                strokeWidth={4}
                strokeLinejoin="round"
                paintOrder="stroke"
              >
                {e.s.label} <tspan className="tabular">{nf.format(e.value)}</tspan>
              </text>
            </g>
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + h} stroke="var(--color-bark)" />
              {series.map((s) =>
                s.values[hover] === null ? null : (
                  <Marker key={s.key} x={x(hover)} y={y(s.values[hover] ?? 0)} fill={s.color} />
                ),
              )}
            </g>
          )}
          <rect
            x={pad.left}
            y={pad.top}
            width={w}
            height={h}
            fill="transparent"
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
              const i = Math.round(((e.clientX - r.left) / r.width) * (days.length - 1));
              setHover(Math.max(0, Math.min(days.length - 1, i)));
            }}
          />
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={x(hover)} y={pad.top + 8} width={width}>
          <div className="mb-1 tabular text-[10px] text-ink/65">{dayLabel(days[hover], { weekday: "short", month: "short", day: "numeric" })}</div>
          {series.map((s) =>
            s.values[hover] === null ? null : (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-ink/75">
                  <span className="h-2 w-2" style={{ background: s.color, opacity: Math.max(0.6, seriesOpacity(s)) }} />
                  {s.label}
                  {s.notes?.[hover] && <span className="text-ink/65">· {s.notes[hover]}</span>}
                </span>
                <span className="font-medium text-ink tabular">{nf.format(s.values[hover] ?? 0)}</span>
              </div>
            ),
          )}
        </Tooltip>
      )}
    </div>
  );
}

/**
 * Daily (or, with `grain="month"`, monthly: `days` are each month's first day) bars with an optional
 * dashed previous-period line on the same axis.
 */
export function BarChart({
  days,
  values,
  compare,
  color = "var(--color-ember)",
  height = 240,
  unit = "kudos",
  grain = "day",
}: {
  days: string[];
  values: number[];
  compare?: (number | null)[] | null;
  color?: string;
  height?: number;
  unit?: string;
  grain?: "day" | "month";
}) {
  const axisLabel = (d: string) => (grain === "month" ? dayLabel(d, { month: "short", year: "numeric" }) : dayLabel(d));
  const tooltipLabel = (d: string) =>
    grain === "month" ? dayLabel(d, { month: "long", year: "numeric" }) : dayLabel(d, { weekday: "short", month: "short", day: "numeric" });
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 12, right: 8, bottom: 28, left: 32 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(1, ...values, ...(compare ?? []).map((v) => v ?? 0)));
  const band = days.length ? w / days.length : 0;
  const barW = Math.max(2, Math.min(28, band - 2));
  const x = (i: number) => pad.left + i * band + band / 2;
  const y = (v: number) => pad.top + h - (v / max) * h;
  const labelEvery = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor(w / 70))));
  const comparePath = compare
    ? monotonePath(compare.flatMap((v, i) => (v === null ? [] : [[x(i), y(v)] as [number, number]])))
    : null;

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={grain === "month" ? "Monthly kudos volume" : "Daily kudos volume"}>
          {[0, max / 2, max].map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + w} y1={y(t)} y2={y(t)} stroke="var(--color-parchment-deep)" />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="fill-ink/65 tabular text-[10px]">
                {nf.format(t)}
              </text>
            </g>
          ))}
          {values.map((v, i) => {
            const bh = Math.max(v > 0 ? 3 : 0, (v / max) * h);
            return (
              <motion.rect
                key={days[i]}
                x={x(i) - barW / 2}
                width={barW}
                shapeRendering="crispEdges"
                initial={{ y: pad.top + h, height: 0 }}
                animate={{ y: pad.top + h - bh, height: bh }}
                transition={{ duration: 0.6, delay: i * 0.006, ease: [0.22, 1, 0.36, 1] }}
                fill={color}
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
            );
          })}
          {comparePath && <path d={comparePath} fill="none" stroke="var(--color-benchmark)" strokeWidth={2} strokeDasharray="4 4" strokeLinecap="square" />}
          {days.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d} x={x(i)} y={height - 8} textAnchor="middle" className="fill-ink/65 tabular text-[10px]">
                {axisLabel(d)}
              </text>
            ) : null,
          )}
          {days.map((d, i) => (
            <rect key={`hit-${d}`} x={pad.left + i * band} y={pad.top} width={band} height={h} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          ))}
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={x(hover)} y={y(values[hover])} width={width}>
          <div className="mb-1 tabular text-[10px] text-ink/65">{tooltipLabel(days[hover])}</div>
          <div className="flex justify-between gap-4">
            <span className="text-ink/75">This period</span>
            <span className="font-medium text-ink tabular">{nf.format(values[hover])} {unit}</span>
          </div>
          {compare && compare[hover] !== null && (
            <div className="flex justify-between gap-4">
              <span className="text-ink/75">Previous period</span>
              <span className="font-medium text-ink tabular">{nf.format(compare[hover] ?? 0)}</span>
            </div>
          )}
        </Tooltip>
      )}
    </div>
  );
}

/**
 * You vs one benchmark on a single metric: two thin bars from a shared baseline, scaled to this row's
 * own max (rows never share a scale), with the values printed in ink at the bar ends.
 */
export function PairedBars({
  you,
  benchmark,
  color,
  benchmarkColor = "var(--color-benchmark)",
  labels = ["You", "Benchmark"],
}: {
  you: number;
  benchmark: number | null;
  color: string;
  benchmarkColor?: string;
  labels?: [string, string];
}) {
  const max = Math.max(1, you, benchmark ?? 0);
  const bars = [
    { key: "you", label: labels[0], value: you, color },
    ...(benchmark === null ? [] : [{ key: "benchmark", label: labels[1], value: benchmark, color: benchmarkColor }]),
  ];
  return (
    <div className="space-y-1.5" role="img" aria-label={bars.map((b) => `${b.label} ${nf.format(b.value)}`).join(", ")}>
      {bars.map((b) => (
        <div key={b.key} className="relative mr-10 h-2">
          <motion.div
            className="absolute inset-y-0 left-0"
            style={{ background: b.color, minWidth: b.value > 0 ? 4 : 0 }}
            initial={{ width: 0 }}
            animate={{ width: `${(b.value / max) * 100}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.span
            className="absolute top-1/2 -translate-y-1/2 pl-2 text-[11px] leading-none text-ink/75 tabular"
            initial={{ left: "0%" }}
            animate={{ left: `${(b.value / max) * 100}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {nf.format(b.value)}
          </motion.span>
        </div>
      ))}
    </div>
  );
}

/** The middle half of the team: benchmark ink as a wash, so the median tick stays the loudest benchmark mark. */
export const BENCHMARK_BAND = "color-mix(in srgb, var(--color-benchmark) 35%, transparent)";

/**
 * Where you sit in the team on one metric: a track from 0 to the team's most, the middle half of the
 * team as a band, the median as a tick (both in benchmark ink) and you as a dot in the metric's family
 * colour. Names nobody, and reads the same for 3 people or 500. The team's most is printed at the end
 * of the track; when you gave more, the track runs on to you and a faint tick marks where the team
 * stops. A team without quartiles (a small one) gets the median alone on a track scaled to fit both
 * marks. The two marks are focusable and show the summary on hover or focus (Escape hides it).
 */
export function RangeStrip({ label, you, team, color }: { label: string; you: number; team: TeamDistribution; color: string }) {
  const [active, setActive] = useState<"you" | "median" | null>(null);
  const end = Math.max(1, you, team.max ?? Math.max(you, team.median) * 1.25);
  const at = (v: number) => `${(Math.min(v, end) / end) * 100}%`;
  const summary = teamSummary(you, team);
  // Each marker leads with the metric and its own number: you first, or the team (the rest of the summary).
  const labels = { you: `${label}: ${summary.join(", ")}`, median: `${label}: ${summary.slice(1).join(", ")}` };
  const marker = (key: "you" | "median", left: string, mark: ReactNode) => (
    <span
      tabIndex={0}
      role="img"
      aria-label={labels[key]}
      className="absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-lantern/60"
      style={{ left }}
      onMouseEnter={() => setActive(key)}
      onMouseLeave={() => setActive(null)}
      onFocus={() => setActive(key)}
      onBlur={() => setActive(null)}
      onKeyDown={(e) => e.key === "Escape" && setActive(null)}
    >
      {mark}
    </span>
  );
  return (
    <div className="relative mr-12 h-6">
      <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-bark/60" />
      {team.p25 !== null && team.p75 !== null && (
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2"
          style={{ left: at(team.p25), width: `calc(${at(team.p75)} - ${at(team.p25)})`, minWidth: 4, background: BENCHMARK_BAND }}
        />
      )}
      {team.max !== null && team.max < end && (
        <span className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-ink/65" style={{ left: at(team.max) }} aria-hidden />
      )}
      {marker("median", at(team.median), <span className="h-3.5 w-0.5" style={{ background: "var(--color-benchmark)" }} />)}
      {marker(
        "you",
        at(you),
        <span className="h-2.5 w-2.5" style={{ background: color, boxShadow: "0 0 0 2px var(--color-parchment)" }} />,
      )}
      {team.max !== null && team.max === end && (
        <span className="absolute left-full top-1/2 -translate-y-1/2 pl-2 text-[11px] leading-none text-ink/65 tabular" aria-hidden>
          {nf.format(team.max)}
        </span>
      )}
      {active && (
        <div
          className="pointer-events-none absolute bottom-full z-10 mb-1.5 min-w-36 -translate-x-1/2 bg-parchment px-3 py-2 text-xs text-ink shadow-[inset_0_0_0_1px_var(--color-bark),2px_2px_0_0_var(--color-dusk-deep)]"
          style={{ left: `clamp(4.5rem, ${at(active === "you" ? you : team.median)}, calc(100% - 4.5rem))` }}
        >
          <div className="mb-0.5 tabular text-[10px] text-ink/65">{label}</div>
          {summary.map((line, i) => (
            <div key={line} className={clsx("whitespace-nowrap tabular", i === 0 ? "text-ink" : "text-ink/75")}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Weekday × hour intensity grid (sequential, one hue). */
export function Heatmap({ data }: { data: number[][] }) {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(1, ...data.flat());
  return (
    <div className="relative">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: "34px repeat(24, minmax(0, 1fr))" }}>
        {data.map((row, d) => (
          <div key={d} className="contents">
            <div className="flex items-center tabular text-[10px] text-ink/65">{DAYS[d]}</div>
            {row.map((v, h) => (
              <div
                key={h}
                onMouseEnter={() => setHover({ d, h })}
                onMouseLeave={() => setHover(null)}
                className={clsx("aspect-square transition-transform", hover?.d === d && hover?.h === h && "scale-125 ring-2 ring-ink")}
                style={{
                  background: v === 0 ? "var(--color-parchment-deep)" : `color-mix(in oklab, var(--color-lantern) ${Math.round(18 + (v / max) * 82)}%, var(--color-parchment-deep))`,
                }}
                aria-label={`${DAYS[d]} ${h}:00 – ${v} kudos`}
              />
            ))}
          </div>
        ))}
        <div />
        {Array.from({ length: 24 }).map((_, h) => (
          <div key={h} className="pt-1 text-center tabular text-[9px] text-ink/65">
            {h % 6 === 0 ? `${h}h` : ""}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-ink/75">
        <span className="tabular">{hover ? `${DAYS[hover.d]} · ${String(hover.h).padStart(2, "0")}:00–${String(hover.h + 1).padStart(2, "0")}:00 · ${nf.format(data[hover.d][hover.h])} kudos` : "Hover a cell for details"}</span>
        <span className="flex items-center gap-1.5">
          Less
          {[0.18, 0.45, 0.72, 1].map((t) => (
            <span key={t} className="h-2.5 w-2.5" style={{ background: `color-mix(in oklab, var(--color-lantern) ${Math.round(t * 100)}%, var(--color-parchment-deep))` }} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}

/** Labelled horizontal bars; text stays in ink colors, the bar carries magnitude. */
export function BarList({
  items,
  color = "var(--color-ember)",
  format = (n: number) => nf.format(n),
}: {
  items: { key: string; label: ReactNode; value: number; color?: string }[];
  color?: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((i, idx) => (
        <li key={i.key} className="group">
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink">{i.label}</span>
            <span className="text-xs text-ink/75 tabular">{format(i.value)}</span>
          </div>
          <div className="h-2 overflow-hidden bg-parchment-deep">
            <motion.div
              className="h-full"
              style={{ background: i.color ?? color }}
              initial={{ width: 0 }}
              animate={{ width: `${(i.value / max) * 100}%` }}
              transition={{ duration: 0.7, delay: idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Ring({ value, size = 88, stroke = 8, color = "var(--color-lantern)", children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-parchment-deep)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/**
 * A small single-series line over months, for a stat tile: a zero-based scale, an optional dashed
 * reference line (a baseline), the latest point marked (hollow while `lastPartial`, e.g. a month
 * to date), and a hover tooltip per month. Gaps (null) break the line.
 */
export function Sparkline({
  labels,
  values,
  reference = null,
  format,
  lastPartial = false,
  color = "var(--color-lantern)",
  height = 64,
  label,
}: {
  labels: string[];
  values: (number | null)[];
  reference?: number | null;
  format: (v: number) => string;
  lastPartial?: boolean;
  color?: string;
  height?: number;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 6, right: 6, bottom: 6, left: 6 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const max = Math.max(...values.map((v) => v ?? 0), reference ?? 0) * 1.1 || 1;
  const x = (i: number) => pad.left + (labels.length <= 1 ? w / 2 : (i / (labels.length - 1)) * w);
  const y = (v: number) => pad.top + h - (v / max) * h;
  // One path per run of non-null values.
  const runs: [number, number][][] = [[]];
  values.forEach((v, i) => (v === null ? runs.push([]) : runs[runs.length - 1].push([x(i), y(v)])));
  const last = lastIndex(values);
  const hollow = lastPartial && last === values.length - 1;
  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="overflow-visible" role="img" aria-label={label}>
          <line x1={pad.left} x2={pad.left + w} y1={y(0)} y2={y(0)} stroke="var(--color-parchment-deep)" />
          {reference !== null && (
            <line x1={pad.left} x2={pad.left + w} y1={y(reference)} y2={y(reference)} stroke="var(--color-benchmark)" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.8} />
          )}
          {runs.map((run, i) =>
            run.length === 1 ? (
              <Marker key={i} x={run[0][0]} y={run[0][1]} fill={color} size={4} ring={false} />
            ) : run.length > 1 ? (
              <path key={i} d={monotonePath(run)} fill="none" stroke={color} strokeWidth={2} strokeLinecap="square" />
            ) : null,
          )}
          {last >= 0 && (
            <Marker x={x(last)} y={y(values[last]!)} fill={hollow ? "var(--color-parchment)" : color} stroke={hollow ? color : undefined} />
          )}
          {hover !== null && values[hover] !== null && (
            <Marker x={x(hover)} y={y(values[hover]!)} fill={color} />
          )}
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="transparent"
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
              const i = Math.round(((e.clientX - r.left - pad.left) / Math.max(1, w)) * (labels.length - 1));
              setHover(Math.max(0, Math.min(labels.length - 1, i)));
            }}
          />
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={x(hover)} y={pad.top} width={width}>
          <div className="tabular text-[10px] text-ink/65">{labels[hover]}</div>
          <div className="font-medium text-ink tabular">{values[hover] === null ? "No kudos" : format(values[hover]!)}</div>
        </Tooltip>
      )}
    </div>
  );
}
