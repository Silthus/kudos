import clsx from "clsx";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { ComparePeriod } from "../../../convex/lib/compare";
import { BigNumber, Card, Eyebrow, PageSkeleton, Trend } from "@/components/ui";
import { dayLabel, nf, rangeLabel } from "@/lib/format";
import { useWorkspaceToday } from "@/lib/period";
import { useStableQuery } from "@/lib/useStableQuery";
import { useViewer } from "@/lib/viewer";
import { Race, Scoreboard, type Row } from "./parts";

type Past = FunctionReturnType<typeof api.compare.past.get>;

/** The Past you benchmark: this period to date against the same days of the previous period. */
export function PastPanel({ period }: { period: ComparePeriod }) {
  const today = useWorkspaceToday();
  const { data, isStale } = useStableQuery(api.compare.past.get, { period, today });
  if (!data) return <PageSkeleton />;
  return (
    <div className={clsx("space-y-4 transition-opacity duration-200", isStale && "opacity-60")} aria-busy={isStale}>
      <Headline data={data} />
      <PastScoreboard data={data} />
      <PastRace data={data} />
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
        {data.benchmarkNote === "notMember" &&
          (data.previousTotal.given === null
            ? `You joined on ${joined(data.joinedOn!)}, so there's no ${data.benchmarkLabel.toLowerCase()} to compare with yet.`
            : `You joined on ${joined(data.joinedOn!)}, after this point ${data.benchmarkLabel.toLowerCase()}. `)}
        {data.previousTotal.given !== null && `${data.benchmarkLabel} finished at ${nf.format(data.previousTotal.given)}.`}
      </p>
    </Card>
  );
}

const joined = (dayKey: string) => dayLabel(dayKey, { month: "long", day: "numeric", year: "numeric" });

function PastScoreboard({ data }: { data: Past }) {
  return (
    <Scoreboard
      rows={data.rows}
      benchmarkLabel={data.benchmarkLabel}
      subtitle={`${data.label} so far vs the same days ${data.benchmarkLabel.toLowerCase()}`}
      deltaHeader="Change"
      renderDelta={(r) => <Delta row={r} />}
      footnote={data.truncated && <span className="text-xs text-faint">Too many kudos this period to count reach and channels.</span>}
    />
  );
}

function Delta({ row }: { row: Row }) {
  if (row.delta === null || row.benchmark.value === null || row.you.value === null) return <span className="text-xs text-faint">—</span>;
  return <Trend cur={row.you.value} prev={row.benchmark.value} compact />;
}

function PastRace({ data }: { data: Past }) {
  return (
    <Race
      period={data.period}
      days={data.race.days}
      you={data.race.you}
      benchmark={data.race.benchmark}
      benchmarkLabel={data.benchmarkLabel}
      benchmarkDays={data.race.previousDays}
      dashed
      emptyCopy={{ given: "Give kudos in Slack to start your streak.", received: "Kudos your teammates give you will show up here." }}
    />
  );
}
