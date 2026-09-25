import clsx from "clsx";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { MIN_DISTRIBUTION, type ComparePeriod } from "../../../convex/lib/compare";
import { BENCHMARK_BAND, RangeStrip } from "@/components/charts";
import { BigNumber, Card, Eyebrow, PageSkeleton } from "@/components/ui";
import { sharePercent, teamHeadline, teamStat } from "@/lib/compare";
import { nf, rangeLabel } from "@/lib/format";
import { useWorkspaceToday } from "@/lib/period";
import { useStableQuery } from "@/lib/useStableQuery";
import { useViewer } from "@/lib/viewer";
import { FAMILY_COLOR, METRIC_META, PERIOD_NOUN, Scoreboard } from "./parts";

type Team = FunctionReturnType<typeof api.compare.team.get>;
type TeamRow = Team["rows"][number];

const SMALL_TEAM = `The spread and your standing appear once ${MIN_DISTRIBUTION} teammates take part.`;

/**
 * The Team benchmark: where you sit among the teammates who took part this period to date. Only the
 * distribution is shown, never a name; small teams get the median alone, and a team of one nothing.
 */
export function TeamPanel({ period }: { period: ComparePeriod }) {
  const today = useWorkspaceToday();
  const { data, isStale } = useStableQuery(api.compare.team.get, { period, today });
  if (!data) return <PageSkeleton />;
  const small = (r: TeamRow) => r.team !== null && r.team.p25 === null;
  const given = data.rows.find((r) => r.metric === "given")!;
  return (
    <div className={clsx("space-y-4 transition-opacity duration-200", isStale && "opacity-60")} aria-busy={isStale}>
      <Headline data={data} given={given} />
      <Scoreboard
        rows={data.rows}
        benchmarkLabel="Team median"
        subtitle={`You and the teammates who took part, ${data.label.toLowerCase()} so far`}
        deltaHeader="You're above"
        visualHeader="Where you sit in the team"
        renderDelta={(r) => <Standing row={r} />}
        renderVisual={(r) => <Strip row={r} />}
        legend={[
          { label: "Team median", color: "var(--color-benchmark)" },
          ...(data.rows.some((r) => r.team?.p25 != null) ? [{ label: "Middle half of the team", color: BENCHMARK_BAND }] : []),
        ]}
        footnote={
          <>
            {/* The headline already says so when Given is the small one. */}
            {!small(given) && data.rows.some(small) && <span className="text-xs text-ink/65">{SMALL_TEAM}</span>}
            {data.truncated && (
              <span className="text-xs text-ink/65">Too much activity to count everyone this {PERIOD_NOUN[data.period]}, so these numbers are partial.</span>
            )}
          </>
        }
      />
    </div>
  );
}

function Headline({ data, given }: { data: Team; given: TeamRow }) {
  const { workspace } = useViewer();
  const when = data.label.toLowerCase();
  const units = workspace.unitPlural;
  const teammates = (n: number) => `${nf.format(n)} ${n === 1 ? "teammate" : "teammates"}`;
  const big = "mr-2 text-5xl text-ink [font-variant-numeric:proportional-nums]";
  const h = teamHeadline({ value: given.you.value, team: given.team, percentile: given.percentile });

  let headline;
  switch (h.kind) {
    case "share":
      headline = (
        <>
          You gave more than <BigNumber value={h.share} className={big} /> of the {teammates(h.teammates)} who gave {units} {when}.
        </>
      );
      break;
    case "everyone":
      headline = (
        <>
          You gave more than <BigNumber value={`all ${nf.format(h.teammates)}`} className={big} /> teammates who gave {units} {when}.
        </>
      );
      break;
    case "firstOne":
      headline = (
        <>
          <BigNumber value={h.teammates} className={big} />
          teammates gave {units} {when}; your first one puts you on the board.
        </>
      );
      break;
    case "median":
    case "alone":
      headline = (
        <>
          <BigNumber value={h.you} className={big} />
          {h.you === 1 ? workspace.unitSingular : units} given {when}
          {h.kind === "median" && (
            <span className="ml-3 text-sm">
              vs a team median of <b className="font-medium text-ink tabular">{teamStat(h.median)}</b> across {teammates(h.teammates)}
            </span>
          )}
        </>
      );
  }

  const team = given.team;
  return (
    <Card className="relative overflow-hidden px-6 py-6 sm:px-8">
      <Eyebrow>{rangeLabel(data.range.start, data.range.end)} · you and the team</Eyebrow>
      <p className="mt-3 text-lg text-ink/75">{headline}</p>
      <p className="mt-2 text-sm text-ink/65">
        {!team
          ? `Not enough teammates were active this ${PERIOD_NOUN[data.period]} to compare.`
          : team.p25 === null || team.p75 === null
            ? SMALL_TEAM
            : `Half the team gave between ${teamStat(team.p25)} and ${teamStat(team.p75)}; the median is ${teamStat(team.median)}.`}
      </p>
    </Card>
  );
}

function Strip({ row }: { row: TeamRow }) {
  if (!row.team) return <span className="text-xs text-ink/65">Too few teammates to compare</span>;
  return <RangeStrip label={METRIC_META[row.metric].label} you={row.you.value ?? 0} team={row.team} color={FAMILY_COLOR[row.family]} />;
}

/** Share of the team strictly below you: neutral ink, since the team isn't a rival. */
function Standing({ row }: { row: TeamRow }) {
  if (row.percentile === null) return <span className="text-xs text-ink/65">—</span>;
  return (
    <span className="bg-parchment-deep px-1.5 py-0.5 text-xs text-ink/75 tabular">
      {/* The desktop column header says "You're above"; the phone cards have no header. */}
      <span className="sm:sr-only">above </span>
      {sharePercent(row.percentile)}
    </span>
  );
}
