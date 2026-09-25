import type { FunctionReturnType } from "convex/server";
import { useState, type ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import type { ComparePeriod, Metric } from "../../../convex/lib/compare";
import { Legend, LineChart, PairedBars } from "@/components/charts";
import { Card, CardHeader, Empty, Eyebrow, Segmented } from "@/components/ui";
import { dayLabel, nf } from "@/lib/format";
import { useViewer } from "@/lib/viewer";

/** One scoreboard row: every benchmark's query returns the same row shape. */
export type Row = FunctionReturnType<typeof api.compare.past.get>["rows"][number];
type Locked = NonNullable<Row["you"]["locked"]>;

export const FAMILY_COLOR = { giving: "var(--color-ember)", receiving: "var(--color-pond)" } as const;

export const METRIC_META: Record<Metric, { label: string; hint: string }> = {
  given: { label: "Given", hint: "Kudos given" },
  received: { label: "Received", hint: "Kudos received" },
  activeDays: { label: "Active days", hint: "Days with any kudos given" },
  maxedDays: { label: "Maxed days", hint: "Days the whole allowance was used" },
  longestStreak: { label: "Longest streak", hint: "Most giving days in a row" },
  reach: { label: "Reach", hint: "Different teammates recognised" },
  channels: { label: "Channels", hint: "Different channels given in" },
  questsCompleted: { label: "Quests completed", hint: "Weekly quests finished" },
  newDiscoveries: { label: "New discoveries", hint: "Bot messages seen for the first time" },
};

export const LOCKED_COPY: Record<Locked, string> = {
  hidden: "Private in this workspace",
  private: "Only visible to each member",
  personal: "Quests are private to each member",
};

const LOCKED_TOOLTIP: Record<Locked, string> = {
  hidden: "An admin has kept received counts private in this workspace",
  private: "Received counts are only visible to each member in this workspace",
  personal: "Quests are only ever shown to the member who completed them",
};

export const PERIOD_NOUN: Record<ComparePeriod, string> = { week: "week", month: "month", quarter: "quarter", year: "year" };

export const formatValue = (n: number | null) => (n === null ? "—" : nf.format(n));

/** A padlock drawn in pixels: an ink shackle over a brass body with a keyhole. */
export function Padlock() {
  return (
    <svg data-padlock width="10" height="12" viewBox="0 0 5 6" shapeRendering="crispEdges" className="shrink-0" aria-hidden>
      <rect x="1" y="0" width="3" height="1" fill="currentColor" />
      <rect x="1" y="1" width="1" height="1" fill="currentColor" />
      <rect x="3" y="1" width="1" height="1" fill="currentColor" />
      <rect x="0" y="2" width="5" height="4" fill="var(--color-soil)" />
      <rect x="1" y="3" width="3" height="2" fill="var(--color-lantern)" />
      <rect x="2" y="3" width="1" height="2" fill="var(--color-soil)" />
    </svg>
  );
}

function LockedCell({ reason }: { reason: Locked }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink/70">
      <Padlock />
      {LOCKED_COPY[reason]}
    </span>
  );
}

/**
 * The pond's headline: you above the water line, the benchmark mirrored in the water below it
 * ("You gave 14", and under the surface "Past you gave 9"), with a note underneath.
 */
export function Reflection({ when, you, mirror, note }: { when: ReactNode; you: ReactNode; mirror: ReactNode; note?: ReactNode }) {
  return (
    <Card data-reflection>
      <div className="px-5 pb-3 pt-4 @lg:px-6">
        <Eyebrow>{when}</Eyebrow>
        <div className="mt-2 text-lg text-ink/75">{you}</div>
      </div>
      <div className="relative border-t-2 border-pond bg-pond/15 px-5 pb-4 pt-3 @lg:px-6">
        {/* Ripples on the water, drawn in pixels. */}
        <span aria-hidden className="absolute right-6 top-3 block h-0.5 w-6 bg-pond/50" />
        <span aria-hidden className="absolute right-10 top-5 block h-0.5 w-3 bg-pond/50" />
        <div className="pr-12 text-lg text-pond-deep">{mirror}</div>
      </div>
      {note && <p className="px-5 py-3 text-sm text-ink/70 @lg:px-6">{note}</p>}
    </Card>
  );
}

/**
 * You against one benchmark, one row per metric: a semantic table on desktop (it doubles as the
 * accessible view of the visuals) and stacked cards on phones. Each row's visual has its own scale
 * (paired bars unless the benchmark draws its own), and the numbers are always printed.
 */
export function Scoreboard<R extends Row>({
  rows,
  benchmarkLabel,
  subtitle,
  deltaHeader,
  renderDelta,
  renderVisual,
  visualHeader = "Bars",
  legend,
  footnote,
}: {
  rows: R[];
  benchmarkLabel: string;
  subtitle: ReactNode;
  deltaHeader: string;
  renderDelta: (row: R) => ReactNode;
  /** The row's picture of you against the benchmark; paired bars by default. */
  renderVisual?: (row: R) => ReactNode;
  /** What the visual column shows, for screen readers. */
  visualHeader?: string;
  /** The benchmark's legend entries, after the two "You" families. */
  legend?: { label: string; color: string }[];
  footnote?: ReactNode;
}) {
  const visual =
    renderVisual ??
    ((r: R) => <PairedBars you={r.you.value ?? 0} benchmark={r.benchmark.value} color={FAMILY_COLOR[r.family]} labels={["You", benchmarkLabel]} />);
  return (
    <Card>
      <CardHeader title="Scoreboard" subtitle={subtitle} />
      <table className="hidden w-full text-sm @lg:table">
        <thead>
          <tr className="border-b border-parchment-deep text-left tabular text-[10px] text-ink/70">
            <th className="py-2 pl-5 font-normal">Metric</th>
            <th className="py-2 text-right font-normal">You</th>
            <th className="py-2 pl-3 text-right font-normal">{benchmarkLabel}</th>
            <th className="w-[38%] py-2 pl-5 font-normal">
              <span className="sr-only">{visualHeader}</span>
            </th>
            <th className="py-2 pr-5 text-right font-normal">{deltaHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.metric} className="border-b border-parchment-deep last:border-0">
              <th scope="row" className="py-3 pl-5 text-left font-normal">
                <div className="text-ink">{METRIC_META[r.metric].label}</div>
                <div className="text-xs text-ink/70">{METRIC_META[r.metric].hint}</div>
              </th>
              {r.you.locked ? (
                <td colSpan={4} className="py-3 pr-5 text-right">
                  <LockedCell reason={r.you.locked} />
                </td>
              ) : (
                <>
                  <td className="py-3 text-right font-medium text-ink tabular">{formatValue(r.you.value)}</td>
                  <td className="py-3 pl-3 text-right text-ink/75 tabular">{formatValue(r.benchmark.value)}</td>
                  <td className="py-3 pl-5">{visual(r)}</td>
                  <td className="py-3 pr-5 text-right">{renderDelta(r)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="space-y-2 px-3 pb-3 @lg:hidden">
        {rows.map((r) => (
          <li key={r.metric} className="border border-parchment-deep bg-parchment-deep/50 px-3 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-ink">{METRIC_META[r.metric].label}</span>
              {r.you.locked ? (
                <LockedCell reason={r.you.locked} />
              ) : (
                <span className="flex items-baseline gap-2 text-sm">
                  <b className="font-medium text-ink tabular">{formatValue(r.you.value)}</b>
                  <span className="text-ink/70">vs</span>
                  <span className="text-ink/75 tabular">{formatValue(r.benchmark.value)}</span>
                  {renderDelta(r)}
                </span>
              )}
            </div>
            {!r.you.locked && (
              <div className="mt-2">{visual(r)}</div>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-parchment-deep px-5 py-3">
        <Legend
          items={[
            { label: "You, giving", color: FAMILY_COLOR.giving },
            { label: "You, receiving", color: FAMILY_COLOR.receiving },
            ...(legend ?? [{ label: benchmarkLabel, color: "var(--color-benchmark)" }]),
          ]}
        />
        {footnote}
      </div>
    </Card>
  );
}

type Series = (number | null)[];

/**
 * Cumulative kudos over the period, you against the benchmark, with a Given/Received toggle that
 * locks while received counts are private, and a "Show data" table.
 */
export function Race({
  period,
  days,
  you,
  benchmark,
  benchmarkLabel,
  dashed = false,
  benchmarkDays,
  emptyCopy,
  receivedLock,
}: {
  period: ComparePeriod;
  days: string[];
  you: { given: Series; received: Series | null };
  benchmark: { given: Series | null; received: Series | null };
  benchmarkLabel: string;
  /** Past you draws the benchmark dashed, like every "previous period" line in the app. */
  dashed?: boolean;
  /** The benchmark's own day for each point, when it differs from `days` (Past you). */
  benchmarkDays?: string[];
  emptyCopy: Record<"given" | "received", string>;
  /** Why received is locked (the Received row's reason), for the toggle's tooltip. */
  receivedLock: Locked | null;
}) {
  const glyph = useViewer().workspace.emojiGlyph;
  const [measure, setMeasure] = useState<"given" | "received">("given");
  const receivedLocked = you.received === null;
  const m = receivedLocked ? "given" : measure;
  const color = m === "given" ? FAMILY_COLOR.giving : FAMILY_COLOR.receiving;
  const mine = m === "given" ? you.given : you.received!;
  const theirs = m === "given" ? benchmark.given : benchmark.received;
  const empty = [...mine, ...(theirs ?? [])].every((v) => !v);
  const notes = benchmarkDays?.map((d) => dayLabel(d));
  const series = [
    { key: "you", label: "You", color, values: mine },
    ...(theirs ? [{ key: "benchmark", label: benchmarkLabel, color: "var(--color-benchmark)", values: theirs, dashed, opacity: 1, notes }] : []),
  ];
  return (
    <Card>
      <CardHeader
        title="The race"
        subtitle={`Cumulative ${m} kudos, day by day through the ${PERIOD_NOUN[period]}`}
        action={
          <Segmented
            size="sm"
            value={m}
            onChange={setMeasure}
            options={[
              { value: "given", label: "Given" },
              {
                value: "received",
                label: (
                  <>
                    {receivedLocked && <Padlock />}Received
                  </>
                ),
                disabled: receivedLocked,
                title: receivedLocked ? LOCKED_TOOLTIP[receivedLock ?? "hidden"] : undefined,
              },
            ]}
          />
        }
      />
      {empty ? (
        <Empty icon={glyph} title="Nothing to compare yet">
          {emptyCopy[m]}
        </Empty>
      ) : (
        <div className="px-3 pb-2 @lg:px-5">
          <div className="hidden @lg:block">
            <LineChart days={days} series={series} height={260} endLabels />
          </div>
          <div className="@lg:hidden">
            <LineChart days={days} series={series} height={200} endLabels />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <Legend items={series.map((s) => ({ label: s.label, color: s.color, dashed: s.dashed }))} />
          </div>
          <RaceTable days={days} you={mine} benchmark={theirs} benchmarkLabel={benchmarkLabel} benchmarkDays={benchmarkDays} />
        </div>
      )}
    </Card>
  );
}

function RaceTable({
  days,
  you,
  benchmark,
  benchmarkLabel,
  benchmarkDays,
}: {
  days: string[];
  you: Series;
  benchmark: Series | null;
  benchmarkLabel: string;
  benchmarkDays?: string[];
}) {
  const short = (d: string) => dayLabel(d, { weekday: "short", month: "short", day: "numeric" });
  return (
    <details className="group mb-3 mt-3 border border-parchment-deep px-3 py-2 text-sm">
      <summary className="cursor-pointer select-none text-xs font-medium text-ink/75 hover:text-ink">Show data</summary>
      <div className="mt-2 max-h-72 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-parchment">
            <tr className="text-left tabular text-[10px] text-ink/70">
              <th className="py-1.5 font-normal">Day</th>
              <th className="py-1.5 text-right font-normal">You, so far</th>
              {benchmark && benchmarkDays && <th className="py-1.5 pl-3 font-normal">{benchmarkLabel}</th>}
              {benchmark && <th className="py-1.5 text-right font-normal">{benchmarkDays ? "so far" : `${benchmarkLabel}, so far`}</th>}
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={d} className="border-t border-parchment-deep">
                <td className="py-1.5 text-ink/75">{short(d)}</td>
                <td className="py-1.5 text-right text-ink tabular">{formatValue(you[i])}</td>
                {benchmark && benchmarkDays && <td className="py-1.5 pl-3 text-ink/75">{short(benchmarkDays[i])}</td>}
                {benchmark && <td className="py-1.5 text-right text-ink/75 tabular">{formatValue(benchmark[i])}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
