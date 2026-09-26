import clsx from "clsx";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { ComparePeriod } from "../../../convex/lib/compare";
import { Avatar, BigNumber, PageSkeleton } from "@/components/ui";
import { firstName, neutralDelta } from "@/lib/compare";
import { nf, rangeLabel } from "@/lib/format";
import { useWorkspaceToday } from "@/lib/period";
import { useStableQuery } from "@/lib/useStableQuery";
import { useViewer } from "@/lib/viewer";
import { PERIOD_NOUN, Race, Reflection, Scoreboard, type Row } from "./parts";

type Teammate = FunctionReturnType<typeof api.compare.teammate.get>;

/**
 * The Teammate benchmark: you and one teammate over this period to date. Deliberately neutral: no
 * winner styling, no red or green, because Kudos rewards generosity rather than rivalry.
 */
export function TeammatePanel({ period, memberId }: { period: ComparePeriod; memberId: string }) {
  const { workspace } = useViewer();
  const today = useWorkspaceToday();
  const { data, isStale } = useStableQuery(api.compare.teammate.get, { period, today, memberId });
  if (!data) return <PageSkeleton />;
  const name = firstName(data.teammate.name);
  return (
    <div className={clsx("space-y-4 transition-opacity duration-200", isStale && "opacity-60")} aria-busy={isStale}>
      <Headline data={data} name={name} />
      <Scoreboard
        rows={data.rows}
        benchmarkLabel={name}
        subtitle={`You and ${name}, ${data.label.toLowerCase()} so far`}
        deltaHeader="Difference"
        renderDelta={(r) => <NeutralDelta row={r} name={name} />}
        footnote={data.truncated && <span className="text-xs text-ink/70">Too many kudos this period to count reach and channels.</span>}
      />
      <Race
        period={data.period}
        days={data.race.days}
        you={data.race.you}
        benchmark={data.race.benchmark}
        benchmarkLabel={name}
        receivedLock={data.rows.find((r) => r.metric === "received")!.you.locked}
        emptyCopy={{
          given: `Neither of you has given ${workspace.unitPlural} this ${PERIOD_NOUN[data.period]} yet. Give some in Slack to get going.`,
          received: `Neither of you has received ${workspace.unitPlural} this ${PERIOD_NOUN[data.period]} yet.`,
        }}
      />
    </div>
  );
}

function Headline({ data, name }: { data: Teammate; name: string }) {
  const { workspace } = useViewer();
  const given = data.rows.find((r) => r.metric === "given")!;
  const you = given.you.value ?? 0;
  const them = given.benchmark.value ?? 0;
  const noun = PERIOD_NOUN[data.period];
  const units = (n: number) => (n === 1 ? workspace.unitSingular : workspace.unitPlural);
  return (
    <Reflection
      when={`${rangeLabel(data.range.start, data.range.end)}, you and ${name}`}
      you={
        <p>
          You gave <BigNumber value={you} className="mx-1 text-5xl text-ink [font-variant-numeric:proportional-nums]" /> {units(you)} {data.label.toLowerCase()}
        </p>
      }
      mirror={
        <p className="flex items-center gap-3">
          <Avatar name={data.teammate.name} src={data.teammate.avatarUrl} size={32} />
          <span>
            {name} gave <BigNumber value={them} className="mx-1 text-3xl [font-variant-numeric:proportional-nums]" /> {units(them)}
          </span>
        </p>
      }
      note={
        them === 0 || you === them
          ? you === 0 && them === 0
            ? `Neither of you has given ${workspace.unitPlural} this ${noun} yet.`
            : them === 0
              ? `${name} hasn't given ${workspace.unitPlural} this ${noun} yet.`
              : `You've both given ${nf.format(you)} so far.`
          : undefined
      }
    />
  );
}

function NeutralDelta({ row, name }: { row: Row; name: string }) {
  if (row.delta === null) return <span className="text-xs text-ink/70">—</span>;
  const text = neutralDelta(row.delta);
  return (
    <span className="text-xs text-ink/75 tabular" title={`You ${text === "same" ? "and " + name + " are level" : text + " vs " + name}`}>
      {text}
    </span>
  );
}
