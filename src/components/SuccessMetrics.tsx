import clsx from "clsx";
import { useQuery } from "convex/react";
import { Download, Info, Table2 } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { Sparkline } from "@/components/charts";
import { Button, Card, CardHeader, Eyebrow, Skeleton } from "@/components/ui";
import { nf } from "@/lib/format";
import { formatMetric, GOAL_LABEL, SUCCESS_METRICS, successCsv, verdict, type SuccessResult } from "@/lib/successMetrics";

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const shortMonthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const date = (month: string) => new Date(`${month}-01T00:00:00Z`);
export const monthLabel = (month: string) => monthFmt.format(date(month));

/** "Jun – Aug 2026", or "Nov 2025 – Jan 2026" across a new year. */
function monthRange(from: string, to: string) {
  if (from === to) return monthLabel(from);
  return from.slice(0, 4) === to.slice(0, 4)
    ? `${shortMonthFmt.format(date(from))} – ${monthLabel(to)}`
    : `${monthLabel(from)} – ${monthLabel(to)}`;
}

function download(result: SuccessResult) {
  const url = URL.createObjectURL(new Blob([successCsv(result)], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `kudos-success-metrics-${result.months.at(-1)?.month ?? "empty"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const VERDICT_CLASS = { better: "text-up", worse: "text-down", same: "text-muted" } as const;

/**
 * The game's success metrics (spec #55 G18), admins only: this month against the baseline of the
 * three complete months before it, a 12-month line per metric, the numbers as a table, and a CSV.
 */
export function SuccessMetrics({ today }: { today: string }) {
  const result = useQuery(api.analytics.successMetrics, { today });
  const [showTable, setShowTable] = useState(false);
  const current = result?.months.at(-1);
  const baseline = result?.baseline ?? null;

  return (
    <Card id="success-metrics" className="mt-4">
      <CardHeader
        title="Game success metrics"
        subtitle={
          baseline
            ? `This month so far against the baseline of ${monthRange(baseline.from, baseline.to)} · the last 12 months, whatever the period above`
            : "Per month, whatever the period above: the baseline to judge the game by"
        }
        action={
          result?.ready ? (
            <div className="flex gap-2">
              <Button size="sm" aria-controls="success-table" aria-expanded={showTable} onClick={() => setShowTable((s) => !s)}>
                <Table2 className="h-3.5 w-3.5" /> {showTable ? "Hide data" : "Show data"}
              </Button>
              <Button size="sm" onClick={() => download(result)}>
                <Download className="h-3.5 w-3.5" /> Download CSV
              </Button>
            </div>
          ) : null
        }
      />
      <div className="px-5 pb-5">
        {!result ? (
          <Skeleton className="h-40" />
        ) : !result.ready ? (
          <p className="flex items-start gap-2 rounded-xl border border-line bg-ink/40 p-4 text-sm text-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            The success metrics appear after the next rollup rebuild has computed them from your history.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              {SUCCESS_METRICS.map((metric) => {
                const value = current?.[metric.key] ?? null;
                const base = baseline?.[metric.key] ?? null;
                const v = verdict(metric, value, base);
                return (
                  <div key={metric.key} data-metric={metric.key} className="rounded-xl border border-line bg-ink/40 p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <Eyebrow>{metric.label}</Eyebrow>
                      <span className="text-[11px] text-faint">{GOAL_LABEL[metric.goal]}</span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-3">
                      <span className="font-display text-3xl font-semibold">{formatMetric(metric.key, value)}</span>
                      <span className={clsx("text-xs", v ? VERDICT_CLASS[v] : "text-muted")}>
                        Baseline {formatMetric(metric.key, base)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-faint">{metric.hint}</p>
                    <div className="mt-3">
                      <Sparkline
                        label={`${metric.label} per month`}
                        labels={result.months.map((m) => monthLabel(m.month) + (m.toDate ? " (to date)" : ""))}
                        values={result.months.map((m) => m[metric.key])}
                        reference={base}
                        format={(n) => formatMetric(metric.key, n)}
                        lastPartial={current?.toDate}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-faint">
              Dashed line: the baseline. Hollow point: this month so far. A kudos counts once per person recognised, whatever its
              amount; thank-backs follow the Quests' 72-hour rule.
            </p>
            {showTable && (
              <div className="mt-4 overflow-x-auto">
                <table id="success-table" className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Month</th>
                      {SUCCESS_METRICS.map((m) => (
                        <th key={m.key} className="py-2 pr-4 text-right font-medium">{m.label}</th>
                      ))}
                      <th className="py-2 pr-4 text-right font-medium">Givers</th>
                      <th className="py-2 text-right font-medium">Kudos</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {result.months.map((row) => (
                      <tr key={row.month} className="border-t border-line">
                        <td className="py-2 pr-4">{monthLabel(row.month)}{row.toDate ? " (to date)" : ""}</td>
                        {SUCCESS_METRICS.map((m) => (
                          <td key={m.key} className="py-2 pr-4 text-right">{formatMetric(m.key, row[m.key])}</td>
                        ))}
                        <td className="py-2 pr-4 text-right">{nf.format(row.givers)} of {nf.format(row.teamSize)}</td>
                        <td className="py-2 text-right">{nf.format(row.kudos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
