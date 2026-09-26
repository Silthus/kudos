import clsx from "clsx";
import { Lock, Sparkles, TrendingUp, Users, Zap } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { Ring } from "@/components/charts";
import { FramedAvatar } from "@/components/cosmetics";
import { PixelArrow, Room } from "@/components/room";
import { Avatar, BigNumber, Empty, meterFill, PageSkeleton, Segmented, TableScroll, Trend } from "@/components/ui";
import { compareWithHref, firstName } from "@/lib/compare";
import { nf, pct, rangeLabel } from "@/lib/format";
import { DEFAULT_PERIOD, PERIOD_OPTIONS, useWorkspaceToday, type Period } from "@/lib/period";
import { useStableQuery } from "@/lib/useStableQuery";
import { useViewer } from "@/lib/viewer";

/** The podium's three steps: gold lantern, parchment silver, soil bronze. */
const STEPS = [
  { face: "bg-lantern", label: "1st", height: "h-20" },
  { face: "bg-parchment-deep", label: "2nd", height: "h-14" },
  { face: "bg-soil text-cream", label: "3rd", height: "h-10" },
];

/**
 * The notice board (#126, #130): the standings pinned up for the period. Pixel tabs pick the
 * period and what's ranked; the podium, then the standings as a parchment table (it scrolls
 * sideways inside itself on a phone), with a Compare button per teammate that walks to the mirror
 * pond. It lays out by the window's width.
 */
export function Leaderboard() {
  const viewer = useViewer();
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [metric, setMetric] = useState<"given" | "received">("given");
  const today = useWorkspaceToday();
  const { data, isStale } = useStableQuery(api.leaderboard.get, { period, metric, today });
  if (!data) return <PageSkeleton />;
  const glyph = data.unit.glyph;
  const podium = data.rows.slice(0, 3);
  const max = Math.max(1, ...data.rows.map((r) => r.value));

  return (
    <div className={clsx("space-y-8", isStale && "[&_section>*]:opacity-60")} aria-busy={isStale}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented wrap value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
          <Segmented
            value={metric}
            onChange={setMetric}
            options={[
              { value: "given", label: "Given" },
              {
                value: "received",
                label: (
                  <>
                    {!data.receivedAllowed && <Lock className="h-3 w-3" aria-hidden />}Received
                  </>
                ),
                disabled: !data.receivedAllowed,
                title: data.receivedAllowed ? undefined : "An admin has kept received counts private in this workspace",
              },
            ]}
          />
        </div>
        <p className="text-[15px] leading-6 text-ink/75">
          {data.range ? rangeLabel(data.range.start, data.range.end) : "Since the beginning"}.{" "}
          {metric === "given" ? "Ranked by generosity: who's been handing out the most kudos." : "Ranked by kudos received."}
        </p>
      </div>

      {podium.length > 0 && (
        <div role="group" className="grid grid-cols-3 items-end gap-3 px-1 @md:gap-6 @md:px-8" aria-label="The top three">
          {[1, 0, 2].map((idx) => {
            const r = podium[idx];
            if (!r) return <div key={idx} />;
            const step = STEPS[idx];
            return (
              <div key={r.member._id} className="flex min-w-0 flex-col items-center text-center">
                <FramedAvatar name={r.member.name} src={r.member.avatarUrl} size={idx === 0 ? 64 : 48} look={r.member.look} />
                <div className="mt-2 w-full truncate font-display text-base font-medium">{r.member.name}</div>
                {r.member.title && <div className="w-full truncate text-xs text-ink/75">{r.member.title}</div>}
                <div className="text-xl font-sans font-bold tabular">
                  {nf.format(r.value)} <span className="text-base">{glyph}</span>
                </div>
                <div className={clsx("pixel-chip mt-2 flex w-full items-start justify-center pt-1.5 font-display text-sm font-medium", step.face, step.height)}>{step.label}</div>
              </div>
            );
          })}
        </div>
      )}

      <Room title="Standings" subtitle={data.previousRange ? `Change compared with ${rangeLabel(data.previousRange.start, data.previousRange.end)}` : undefined}>
        {data.rows.length === 0 ? (
          <Empty title="No kudos in this period yet">The first person to share some appreciation takes the top spot.</Empty>
        ) : (
          <TableScroll>
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink/70">
                  <th className="w-12 px-2 py-2 font-semibold">Rank</th>
                  <th className="px-2 py-2 font-semibold">Teammate</th>
                  <th className="w-40 px-2 py-2 font-semibold">Kudos {data.metric}</th>
                  <th className="px-2 py-2 text-right font-semibold">Change</th>
                  <th className="px-2 py-2 text-right font-semibold" title="Days the daily allowance was fully used">
                    Maxed days
                  </th>
                  <th className="w-24 px-2 py-2 font-semibold">
                    <span className="sr-only">Compare</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.member._id} className={clsx("border-t-2 border-parchment-deep", r.isMe && "bg-lantern/20")}>
                    <td className="px-2 py-2.5">
                      <span className={clsx("pixel-chip grid h-7 w-7 place-items-center text-sm font-sans font-bold tabular", r.rank <= 3 ? "bg-lantern text-ink" : "bg-parchment text-ink/75")}>{r.rank}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-3">
                        <FramedAvatar name={r.member.name} src={r.member.avatarUrl} size={30} look={r.member.look} />
                        <div className="min-w-0">
                          <div className="truncate font-semibold">
                            {r.member.name}
                            {r.isMe && <span className="pixel-chip ml-2 bg-lantern px-1.5 text-[11px] font-semibold text-ink">You</span>}
                          </div>
                          {r.member.title && <div className="truncate text-xs text-ink/70">{r.member.title}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="w-8 text-right text-base font-sans font-bold tabular">{nf.format(r.value)}</span>
                        <div className="pixel-meter h-2.5 min-w-0 flex-1">
                          <div data-fill style={{ "--fill": meterFill(r.value, max), background: "var(--color-soil)" } as React.CSSProperties} />
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <Change delta={r.delta} rankChange={r.rankChange} isNew={r.isNew} />
                    </td>
                    <td className="px-2 py-2.5 text-right tabular text-ink/75">{r.maxedDays > 0 ? <span className="text-ink">{r.maxedDays}</span> : "0"}</td>
                    <td className="px-2 py-2.5 text-right">{r.comparable && <CompareWith memberId={r.member._id} name={r.member.name} period={period} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Room>

      {data.myRow && (
        <div className="pixel-note flex items-center gap-3 px-4 py-3">
          <Avatar name={viewer.member.name} src={viewer.member.avatarUrl} size={40} />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-ink/75">Your place</div>
            <div className="font-display text-2xl font-medium">#{data.myRow.rank}</div>
            <div className="text-xs text-ink/75">
              {data.myRow.value} {glyph} {data.metric}
            </div>
          </div>
          <div className="ml-auto">
            <Change delta={data.myRow.delta} rankChange={data.myRow.rankChange} isNew={data.myRow.isNew} />
          </div>
        </div>
      )}

      <Room title="This period">
        <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
          <div className="pixel-chip bg-parchment-deep/40 p-4">
            <div className="text-xs font-semibold text-ink/75">Kudos shared</div>
            <div className="mt-1 flex items-baseline gap-2">
              <BigNumber value={data.highlights.total} className="text-4xl" />
              <span className="text-2xl">{glyph}</span>
            </div>
            <div className="mt-1">
              <Trend cur={data.highlights.total} prev={data.highlights.prevTotal} suffix="on last period to date" />
            </div>
          </div>
          <div className="pixel-chip flex items-center gap-4 bg-parchment-deep/40 p-4">
            <Ring value={data.highlights.participation} color="var(--color-pond)">
              <span className="text-lg font-sans font-bold tabular">{pct(data.highlights.participation)}</span>
            </Ring>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-ink/75">Participation</div>
              <p className="mt-1 text-sm text-ink/75">
                <b className="text-ink">{data.highlights.givers}</b> of {data.highlights.teamSize} teammates gave kudos
              </p>
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 @lg:grid-cols-4">
          <MiniStat icon={<TrendingUp className="h-4 w-4 text-hedge-deep" />} label="Rising" value={data.highlights.rising} hint="gave more than last period" />
          <MiniStat icon={<Zap className="h-4 w-4 text-soil" />} label="Maxed days" value={data.highlights.maxedDays} hint="full allowance used" />
          <MiniStat icon={<Sparkles className="h-4 w-4 text-r-epic" />} label="Discoveries" value={data.highlights.discoveries} hint="messages found" />
          <MiniStat icon={<Users className="h-4 w-4 text-soil" />} label="Legendary" value={data.highlights.legendaryFinds} hint="legendary finds" />
        </div>
      </Room>
    </div>
  );
}

/** Row action: a head-to-head with this teammate at the mirror pond. */
function CompareWith({ memberId, name, period }: { memberId: string; name: string; period: Period }) {
  return (
    <Link to={compareWithHref(memberId, period)} aria-label={`Compare with ${firstName(name)}`} className="pixel-btn pixel-btn-secondary inline-flex h-8 items-center px-2.5 text-xs font-semibold">
      Compare
    </Link>
  );
}

function Change({ delta, rankChange, isNew }: { delta: number | null; rankChange: number | null; isNew: boolean }) {
  if (delta === null)
    return (
      <span className="text-ink/70">
        <span aria-hidden>–</span>
        <span className="sr-only">No earlier period</span>
      </span>
    );
  if (isNew) return <span className="pixel-chip bg-r-epic/25 px-2 py-0.5 text-[11px] font-semibold text-ink">New</span>;
  const places = rankChange === null ? 0 : Math.abs(rankChange);
  return (
    <span className="inline-flex items-center gap-2">
      {rankChange !== null && rankChange !== 0 && (
        <span className={clsx("inline-flex items-center gap-1 tabular text-[11px] font-semibold", rankChange > 0 ? "text-hedge-deep" : "text-ember-deep")}>
          <PixelArrow up={rankChange > 0} />
          {places}
          <span className="sr-only">{` ${places === 1 ? "place" : "places"} ${rankChange > 0 ? "up" : "down"}`}</span>
        </span>
      )}
      <span className={clsx("text-xs tabular", delta > 0 ? "text-hedge-deep" : delta < 0 ? "text-ember-deep" : "text-ink/70")}>{delta > 0 ? `+${delta}` : delta === 0 ? "±0" : delta}</span>
    </span>
  );
}

function MiniStat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint: string }) {
  return (
    <div className="pixel-chip min-w-0 bg-parchment-deep/40 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-ink/75">
        {icon}
        {label}
      </div>
      <BigNumber value={value} className="mt-1 block text-3xl" />
      <div className="text-[11px] text-ink/70">{hint}</div>
    </div>
  );
}
