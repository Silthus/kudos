import clsx from "clsx";
import { motion } from "motion/react";
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden>
            <line x1="1" x2="17" y1="4" y2="4" stroke={i.color} strokeWidth="2" strokeLinecap="round" strokeDasharray={i.dashed ? "3 3" : undefined} />
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
      className="pointer-events-none absolute z-10 min-w-40 -translate-x-1/2 -translate-y-full rounded-xl border border-line-strong bg-panel-2/95 px-3 py-2 text-xs shadow-2xl backdrop-blur"
      style={{ left, top: y - 10 }}
    >
      {children}
    </div>
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
          <defs>
            <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={first?.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={first?.color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + w} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="fill-faint font-mono text-[10px]">
                {nf.format(t)}
              </text>
            </g>
          ))}
          {days.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d} x={x(i)} y={height - 8} textAnchor="middle" className="fill-faint font-mono text-[10px]">
                {dayLabel(d)}
              </text>
            ) : null,
          )}
          {area && <motion.path d={area} fill="url(#area-fill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />}
          {series.map((s, si) => (
            <motion.path
              key={s.key}
              d={paths[si]}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={s.dashed ? "4 4" : undefined}
              // Drawing a line in animates its dash array, which would erase a dashed series' dashes: fade those in.
              initial={s.dashed ? { opacity: 0 } : { pathLength: 0, opacity: seriesOpacity(s) }}
              animate={s.dashed ? { opacity: seriesOpacity(s) } : { pathLength: 1, opacity: seriesOpacity(s) }}
              transition={{ duration: s.dashed ? 0.6 : 1, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
          {ends.map((e, i) => (
            <g key={e.s.key}>
              <circle cx={e.x} cy={e.y} r={4} fill={e.s.color} stroke="var(--color-panel)" strokeWidth={2} />
              <text
                x={e.x + 9}
                y={endYs[i] + 4}
                className="fill-cream text-[11px] font-medium"
                stroke="var(--color-panel)"
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
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + h} stroke="var(--color-line-strong)" />
              {series.map((s) =>
                s.values[hover] === null ? null : (
                  <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4.5} fill={s.color} stroke="var(--color-panel)" strokeWidth={2} />
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
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-faint">{dayLabel(days[hover], { weekday: "short", month: "short", day: "numeric" })}</div>
          {series.map((s) =>
            s.values[hover] === null ? null : (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color, opacity: Math.max(0.6, seriesOpacity(s)) }} />
                  {s.label}
                  {s.notes?.[hover] && <span className="text-faint">· {s.notes[hover]}</span>}
                </span>
                <span className="font-medium text-cream tabular">{nf.format(s.values[hover] ?? 0)}</span>
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
  color = "var(--color-saffron-deep)",
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
              <line x1={pad.left} x2={pad.left + w} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="fill-faint font-mono text-[10px]">
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
                rx={Math.min(4, barW / 2)}
                initial={{ y: pad.top + h, height: 0 }}
                animate={{ y: pad.top + h - bh, height: bh }}
                transition={{ duration: 0.6, delay: i * 0.006, ease: [0.22, 1, 0.36, 1] }}
                fill={color}
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
            );
          })}
          {comparePath && <path d={comparePath} fill="none" stroke="var(--color-cream)" strokeOpacity={0.45} strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" />}
          {days.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d} x={x(i)} y={height - 8} textAnchor="middle" className="fill-faint font-mono text-[10px]">
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
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-faint">{tooltipLabel(days[hover])}</div>
          <div className="flex justify-between gap-4">
            <span className="text-muted">This period</span>
            <span className="font-medium text-cream tabular">{nf.format(values[hover])} {unit}</span>
          </div>
          {compare && compare[hover] !== null && (
            <div className="flex justify-between gap-4">
              <span className="text-muted">Previous period</span>
              <span className="font-medium text-cream tabular">{nf.format(compare[hover] ?? 0)}</span>
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
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: b.color, minWidth: b.value > 0 ? 4 : 0 }}
            initial={{ width: 0 }}
            animate={{ width: `${(b.value / max) * 100}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.span
            className="absolute top-1/2 -translate-y-1/2 pl-2 font-mono text-[11px] leading-none text-muted tabular"
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
            <div className="flex items-center font-mono text-[10px] text-faint">{DAYS[d]}</div>
            {row.map((v, h) => (
              <div
                key={h}
                onMouseEnter={() => setHover({ d, h })}
                onMouseLeave={() => setHover(null)}
                className={clsx("aspect-square rounded-[4px] transition-transform", hover?.d === d && hover?.h === h && "scale-125 ring-2 ring-cream/70")}
                style={{
                  background: v === 0 ? "var(--color-panel-3)" : `color-mix(in oklab, var(--color-saffron) ${Math.round(18 + (v / max) * 82)}%, var(--color-panel-3))`,
                }}
                aria-label={`${DAYS[d]} ${h}:00 – ${v} kudos`}
              />
            ))}
          </div>
        ))}
        <div />
        {Array.from({ length: 24 }).map((_, h) => (
          <div key={h} className="pt-1 text-center font-mono text-[9px] text-faint">
            {h % 6 === 0 ? `${h}h` : ""}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span className="tabular">{hover ? `${DAYS[hover.d]} · ${String(hover.h).padStart(2, "0")}:00–${String(hover.h + 1).padStart(2, "0")}:00 · ${nf.format(data[hover.d][hover.h])} kudos` : "Hover a cell for details"}</span>
        <span className="flex items-center gap-1.5">
          Less
          {[0.18, 0.45, 0.72, 1].map((t) => (
            <span key={t} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: `color-mix(in oklab, var(--color-saffron) ${Math.round(t * 100)}%, var(--color-panel-3))` }} />
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
  color = "var(--color-saffron-deep)",
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
            <span className="min-w-0 truncate text-cream">{i.label}</span>
            <span className="font-mono text-xs text-muted tabular">{format(i.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-panel-3">
            <motion.div
              className="h-full rounded-full"
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

export function Ring({ value, size = 88, stroke = 8, color = "var(--color-saffron)", children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-panel-3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
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
