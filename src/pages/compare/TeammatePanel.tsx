import clsx from "clsx";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { ComparePeriod } from "../../../convex/lib/compare";
import { Avatar, BigNumber, Card, Eyebrow, PageSkeleton } from "@/components/ui";
import { firstName, neutralDelta } from "@/lib/compare";
import { nf, rangeLabel } from "@/lib/format";
import { useWorkspaceToday } from "@/lib/period";
import { useStableQuery } from "@/lib/useStableQuery";
import { useViewer } from "@/lib/viewer";
import { PERIOD_NOUN, Race, Scoreboard, type Row } from "./parts";

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
        footnote={data.truncated && <span className="text-xs text-ink/65">Too many kudos this period to count reach and channels.</span>}
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
  return (
    <Card className="relative overflow-hidden px-6 py-6 sm:px-8">
      <Eyebrow>
        {rangeLabel(data.range.start, data.range.end)} · you and {name}
      </Eyebrow>
      <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-3">
        <Side label="You" value={you} />
        <Side label={name} value={them} avatar={{ name: data.teammate.name, src: data.teammate.avatarUrl }} muted />
        <p className="text-lg text-ink/75">
          {workspace.unitPlural} given {data.label.toLowerCase()}
        </p>
      </div>
      {(them === 0 || you === them) && (
        <p className="mt-2 text-sm text-ink/65">
          {you === 0 && them === 0
            ? `Neither of you has given ${workspace.unitPlural} this ${noun} yet.`
            : them === 0
              ? `${name} hasn't given ${workspace.unitPlural} this ${noun} yet.`
              : `You've both given ${nf.format(you)} so far.`}
        </p>
      )}
    </Card>
  );
}

function Side({ label, value, avatar, muted }: { label: string; value: number; avatar?: { name: string; src?: string }; muted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      {avatar && <Avatar name={avatar.name} src={avatar.src} size={36} />}
      <span className="flex flex-col">
        <span className="tabular text-[10px] text-ink/65">{label}</span>
        <BigNumber value={value} className={clsx("text-5xl [font-variant-numeric:proportional-nums]", muted ? "text-ink/75" : "text-ink")} />
      </span>
    </span>
  );
}

function NeutralDelta({ row, name }: { row: Row; name: string }) {
  if (row.delta === null) return <span className="text-xs text-ink/65">—</span>;
  const text = neutralDelta(row.delta);
  return (
    <span className="text-xs text-ink/75 tabular" title={`You ${text === "same" ? "and " + name + " are level" : text + " vs " + name}`}>
      {text}
    </span>
  );
}
