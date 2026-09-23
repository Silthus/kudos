import clsx from "clsx";
import type { FunctionReturnType } from "convex/server";
import { Lock } from "lucide-react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { ComparePeriod, Metric } from "../../../convex/lib/compare";
import { Legend, LineChart, PairedBars } from "@/components/charts";
import { BigNumber, Card, CardHeader, Empty, Eyebrow, PageSkeleton, Segmented, Trend } from "@/components/ui";
import { dayLabel, nf, rangeLabel } from "@/lib/format";
import { useWorkspaceToday } from "@/lib/period";
import { useStableQuery } from "@/lib/useStableQuery";
import { useViewer } from "@/lib/viewer";

type Past = FunctionReturnType<typeof api.compare.past.get>;
type Row = Past["rows"][number];

export const FAMILY_COLOR = { giving: "var(--color-saffron-deep)", receiving: "var(--color-teal)" } as const;

export const METRIC_META: Record<Metric, { label: string; hint: string }> = {
  given: { label: "Given", hint: "Kudos you gave" },
  received: { label: "Received", hint: "Kudos you received" },
  activeDays: { label: "Active days", hint: "Days you gave any kudos" },
  maxedDays: { label: "Maxed days", hint: "Days you used your whole allowance" },
  longestStreak: { label: "Longest streak", hint: "Most giving days in a row" },
  reach: { label: "Reach", hint: "Different teammates you recognised" },
  channels: { label: "Channels", hint: "Different channels you gave in" },
  newDiscoveries: { label: "New discoveries", hint: "Bot messages you saw for the first time" },
};

export const LOCKED_COPY = { hidden: "Private in this workspace", private: "Only visible to each member" } as const;

const PERIOD_NOUN: Record<ComparePeriod, string> = { week: "week", month: "month", quarter: "quarter", year: "year" };

/** The Past you benchmark: this period to date against the same days of the previous period. */
export function PastPanel({ period }: { period: ComparePeriod }) {
  const today = useWorkspaceToday();
  const { data, isStale } = useStableQuery(api.compare.past.get, { period, today });
  if (!data) return <PageSkeleton />;
  return (
    <div className={clsx("space-y-4 transition-opacity duration-200", isStale && "opacity-60")} aria-busy={isStale}>
      <Headline data={data} />
      <Scoreboard data={data} />
      <Race data={data} />
    </div>
  );
}

function Headline({ data }: { data: Past }) {
  const viewer = useViewer();
  const given = data.rows.find((r) => r.metric === "given")!;
  const you = given.you.value ?? 0;
  const unit = you === 1 ? viewer.workspace.unitSingular : viewer.workspace.unitPlural;
  return (
    <Card className="grain overflow-hidden px-6 py-6 sm:px-8">
      <Eyebrow>
        {rangeLabel(data.range.start, data.range.end)}
        {data.benchmarkNote === null && ` vs ${rangeLabel(data.benchmarkRange.start, data.benchmarkRange.end)}`}
      </Eyebrow>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <p className="text-lg text-muted">
          <BigNumber value={you} className="mr-2 text-5xl text-cream [font-variant-numeric:proportional-nums]" />
          {unit} given {data.label.toLowerCase()}
        </p>
        {given.benchmark.value !== null && (
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            <Trend cur={you} prev={given.benchmark.value} compact />
            <span>
              vs <b className="font-medium text-cream tabular">{nf.format(given.benchmark.value)}</b> by this point {data.benchmarkLabel.toLowerCase()}
            </span>
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-faint">
        {data.benchmarkNote === "notMember"
          ? `You joined on ${dayLabel(data.joinedOn!, { month: "long", day: "numeric", year: "numeric" })}, so there's no ${data.benchmarkLabel.toLowerCase()} to compare with yet.`
          : data.previousTotal.given !== null && `${data.benchmarkLabel} finished at ${nf.format(data.previousTotal.given)}.`}
      </p>
    </Card>
  );
}

function LockedCell() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-faint">
      <Lock className="h-3 w-3" aria-hidden />
      {LOCKED_COPY.hidden}
    </span>
  );
}

const value = (n: number | null) => (n === null ? "—" : nf.format(n));

function Scoreboard({ data }: { data: Past }) {
  const benchmark = data.benchmarkLabel;
  return (
    <Card>
      <CardHeader title="Scoreboard" subtitle={`${data.label} so far vs the same days ${benchmark.toLowerCase()}`} />
      {/* Desktop: the table doubles as the accessible table view of the bars. */}
      <table className="hidden w-full text-sm sm:table">
        <thead>
          <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-wider text-faint">
            <th className="py-2 pl-5 font-normal">Metric</th>
            <th className="py-2 text-right font-normal">You</th>
            <th className="py-2 pl-3 text-right font-normal">{benchmark}</th>
            <th className="w-[38%] py-2 pl-5 font-normal">
              <span className="sr-only">Bars</span>
            </th>
            <th className="py-2 pr-5 text-right font-normal">Change</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.metric} className="border-b border-line/60 last:border-0">
              <th scope="row" className="py-3 pl-5 text-left font-normal">
                <div className="text-cream">{METRIC_META[r.metric].label}</div>
                <div className="text-xs text-faint">{METRIC_META[r.metric].hint}</div>
              </th>
              {r.you.locked ? (
                <td colSpan={4} className="py-3 pr-5 text-right">
                  <LockedCell />
                </td>
              ) : (
                <>
                  <td className="py-3 text-right font-medium text-cream tabular">{value(r.you.value)}</td>
                  <td className="py-3 pl-3 text-right text-muted tabular">{value(r.benchmark.value)}</td>
                  <td className="py-3 pl-5">
                    <PairedBars you={r.you.value ?? 0} benchmark={r.benchmark.value} color={FAMILY_COLOR[r.family]} labels={["You", benchmark]} />
                  </td>
                  <td className="py-3 pr-5 text-right">
                    <Delta row={r} />
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Phones: one stacked card per metric. */}
      <ul className="space-y-2 px-3 pb-3 sm:hidden">
        {data.rows.map((r) => (
          <li key={r.metric} className="rounded-xl border border-line/70 bg-panel-2/50 px-3 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-cream">{METRIC_META[r.metric].label}</span>
              {r.you.locked ? (
                <LockedCell />
              ) : (
                <span className="flex items-baseline gap-2 text-sm">
                  <b className="font-medium text-cream tabular">{value(r.you.value)}</b>
                  <span className="text-faint">vs</span>
                  <span className="text-muted tabular">{value(r.benchmark.value)}</span>
                  <Delta row={r} />
                </span>
              )}
            </div>
            {!r.you.locked && (
              <div className="mt-2">
                <PairedBars you={r.you.value ?? 0} benchmark={r.benchmark.value} color={FAMILY_COLOR[r.family]} labels={["You", benchmark]} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-5 py-3">
        <Legend
          items={[
            { label: "You · giving", color: FAMILY_COLOR.giving },
            { label: "You · receiving", color: FAMILY_COLOR.receiving },
            { label: benchmark, color: "var(--color-benchmark)" },
          ]}
        />
        {data.truncated && <span className="text-xs text-faint">Reach and channels count your most recent 2,000 kudos in each range.</span>}
      </div>
    </Card>
  );
}

function Delta({ row }: { row: Row }) {
  if (row.delta === null || row.benchmark.value === null || row.you.value === null) return <span className="text-xs text-faint">—</span>;
  return <Trend cur={row.you.value} prev={row.benchmark.value} compact />;
}

function Race({ data }: { data: Past }) {
  const glyph = useViewer().workspace.emojiGlyph;
  const [measure, setMeasure] = useState<"given" | "received">("given");
  const receivedLocked = data.race.you.received === null;
  const m = receivedLocked ? "given" : measure;
  const color = m === "given" ? FAMILY_COLOR.giving : FAMILY_COLOR.receiving;
  const you = m === "given" ? data.race.you.given : data.race.you.received!;
  const benchmark = m === "given" ? data.race.benchmark.given : data.race.benchmark.received;
  const everything = [...you, ...(benchmark ?? [])];
  const empty = everything.every((v) => !v);
  const notes = data.race.previousDays.map((d) => dayLabel(d));
  const series = [
    { key: "you", label: "You", color, values: you },
    ...(benchmark ? [{ key: "benchmark", label: data.benchmarkLabel, color: "var(--color-benchmark)", values: benchmark, dashed: true, opacity: 1, notes }] : []),
  ];
  return (
    <Card>
      <CardHeader
        title="The race"
        subtitle={`Cumulative ${m} kudos, day by day through the ${PERIOD_NOUN[data.period]}`}
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
                    {receivedLocked && <Lock className="h-3 w-3" />}Received
                  </>
                ),
                disabled: receivedLocked,
                title: receivedLocked ? "An admin has kept received counts private in this workspace" : undefined,
              },
            ]}
          />
        }
      />
      {empty ? (
        <Empty icon={glyph} title="Nothing to compare yet">
          Give kudos in Slack to start your streak.
        </Empty>
      ) : (
        <div className="px-3 pb-2 sm:px-5">
          <div className="hidden sm:block">
            <LineChart days={data.race.days} series={series} height={260} endLabels />
          </div>
          <div className="sm:hidden">
            <LineChart days={data.race.days} series={series} height={200} endLabels />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <Legend items={series.map((s) => ({ label: s.label, color: s.color, dashed: s.dashed }))} />
          </div>
          <RaceTable data={data} you={you} benchmark={benchmark} />
        </div>
      )}
    </Card>
  );
}

function RaceTable({ data, you, benchmark }: { data: Past; you: (number | null)[]; benchmark: (number | null)[] | null }) {
  return (
    <details className="group mb-3 mt-3 rounded-xl border border-line/70 px-3 py-2 text-sm">
      <summary className="cursor-pointer select-none text-xs font-medium text-muted hover:text-cream">Show data</summary>
      <div className="mt-2 max-h-72 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-panel">
            <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-faint">
              <th className="py-1.5 font-normal">Day</th>
              <th className="py-1.5 text-right font-normal">You, so far</th>
              {benchmark && <th className="py-1.5 pl-3 font-normal">{data.benchmarkLabel}</th>}
              {benchmark && <th className="py-1.5 text-right font-normal">so far</th>}
            </tr>
          </thead>
          <tbody>
            {data.race.days.map((d, i) => (
              <tr key={d} className="border-t border-line/50">
                <td className="py-1.5 text-muted">{dayLabel(d, { weekday: "short", month: "short", day: "numeric" })}</td>
                <td className="py-1.5 text-right text-cream tabular">{value(you[i])}</td>
                {benchmark && <td className="py-1.5 pl-3 text-muted">{dayLabel(data.race.previousDays[i], { weekday: "short", month: "short", day: "numeric" })}</td>}
                {benchmark && <td className="py-1.5 text-right text-muted tabular">{value(benchmark[i])}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
