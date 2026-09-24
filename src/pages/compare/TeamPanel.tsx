import clsx from "clsx";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { MIN_DISTRIBUTION, type ComparePeriod } from "../../../convex/lib/compare";
import { BENCHMARK_BAND, RangeStrip } from "@/components/charts";
import { BigNumber, Card, Eyebrow, PageSkeleton } from "@/components/ui";
import { sharePercent, teamStat } from "@/lib/compare";
import { nf, rangeLabel } from "@/lib/format";
import { useWorkspaceToday } from "@/lib/period";
import { useStableQuery } from "@/lib/useStableQuery";
import { useViewer } from "@/lib/viewer";
import { FAMILY_COLOR, PERIOD_NOUN, Scoreboard } from "./parts";

type Team = FunctionReturnType<typeof api.compare.team.get>;
type TeamRow = Team["rows"][number];

/**
 * The Team benchmark: where you sit among the teammates who took part this period to date. Only the
 * distribution is shown, never a name; small teams get the median alone, and a team of one nothing.
 */
export function TeamPanel({ period }: { period: ComparePeriod }) {
  const today = useWorkspaceToday();
  const { data, isStale } = useStableQuery(api.compare.team.get, { period, today });
  if (!data) return <PageSkeleton />;
  const small = data.rows.some((r) => r.team && r.team.p25 === null);
  return (
    <div className={clsx("space-y-4 transition-opacity duration-200", isStale && "opacity-60")} aria-busy={isStale}>
      <Headline data={data} />
      <Scoreboard
        rows={data.rows}
        benchmarkLabel="Team median"
        subtitle={`You and the teammates who took part, ${data.label.toLowerCase()} so far`}
        deltaHeader="You're above"
        renderDelta={(r) => <Standing row={r} />}
        renderVisual={(r) => <Strip row={r} />}
        legend={[
          { label: "Team median", color: "var(--color-benchmark)" },
          ...(data.rows.some((r) => r.team?.p25 != null) ? [{ label: "Middle half of the team", color: BENCHMARK_BAND }] : []),
        ]}
        footnote={
          <>
            {small && <span className="text-xs text-faint">The spread and your standing appear once {MIN_DISTRIBUTION} teammates take part.</span>}
            {data.truncated && <span className="text-xs text-faint">This workspace's statistics are still being built, so older days may be missing.</span>}
          </>
        }
      />
    </div>
  );
}

function Headline({ data }: { data: Team }) {
  const { workspace } = useViewer();
  const given = data.rows.find((r) => r.metric === "given")!;
  const you = given.you.value ?? 0;
  const when = data.label.toLowerCase();
  const noun = PERIOD_NOUN[data.period];
  const units = workspace.unitPlural;
  const teammates = `${nf.format(data.participants)} ${data.participants === 1 ? "teammate" : "teammates"}`;
  const big = "mr-2 text-5xl text-cream [font-variant-numeric:proportional-nums]";

  let headline;
  if (given.percentile !== null) {
    headline = (
      <p className="text-lg text-muted">
        You gave more than <BigNumber value={sharePercent(given.percentile)} className={big} /> of the {teammates} who gave {units} {when}.
      </p>
    );
  } else if (given.team && given.team.p25 !== null) {
    headline = (
      <p className="text-lg text-muted">
        <BigNumber value={data.participants} className={big} />
        teammates gave {units} {when}; your first one puts you on the board.
      </p>
    );
  } else {
    headline = (
      <p className="text-lg text-muted">
        <BigNumber value={you} className={big} />
        {you === 1 ? workspace.unitSingular : units} given {when}
        {given.team && (
          <span className="ml-3 text-sm">
            vs a team median of <b className="font-medium text-cream tabular">{teamStat(given.team.median)}</b> across {teammates}
          </span>
        )}
      </p>
    );
  }

  return (
    <Card className="grain overflow-hidden px-6 py-6 sm:px-8">
      <Eyebrow>{rangeLabel(data.range.start, data.range.end)} · you and the team</Eyebrow>
      <div className="mt-3">{headline}</div>
      <p className="mt-2 text-sm text-faint">
        {!given.team
          ? `Not enough teammates were active this ${noun} to compare.`
          : given.team.p25 === null
            ? `The spread and your standing appear once ${MIN_DISTRIBUTION} teammates take part.`
            : `Half the team gave between ${teamStat(given.team.p25!)} and ${teamStat(given.team.p75!)}; the median is ${teamStat(given.team.median)}.`}
      </p>
    </Card>
  );
}

function Strip({ row }: { row: TeamRow }) {
  if (!row.team) return <span className="text-xs text-faint">Too few teammates to compare</span>;
  return <RangeStrip you={row.you.value ?? 0} team={row.team} color={FAMILY_COLOR[row.family]} />;
}

/** Share of the team strictly below you: neutral ink, since the team isn't a rival. */
function Standing({ row }: { row: TeamRow }) {
  if (row.percentile === null) return <span className="text-xs text-faint">—</span>;
  return (
    <span className="rounded-md bg-panel-3 px-1.5 py-0.5 font-mono text-xs text-muted tabular" title={`You're above ${sharePercent(row.percentile)} of the team`}>
      {sharePercent(row.percentile)}
    </span>
  );
}
