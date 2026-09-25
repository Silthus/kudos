import clsx from "clsx";
import { motion } from "motion/react";
import { ArrowDown, ArrowLeftRight, ArrowUp, Lock, Sparkles, TrendingUp, Users, Zap } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { Ring } from "@/components/charts";
import { FramedAvatar } from "@/components/cosmetics";
import { Avatar, BigNumber, Card, CardHeader, Empty, Eyebrow, PageHeader, PageSkeleton, Segmented, TableScroll, Trend } from "@/components/ui";
import { compareWithHref, firstName } from "@/lib/compare";
import { nf, pct, rangeLabel } from "@/lib/format";
import { DEFAULT_PERIOD, PERIOD_OPTIONS, useWorkspaceToday, type Period } from "@/lib/period";
import { useStableQuery } from "@/lib/useStableQuery";
import { useViewer } from "@/lib/viewer";

const MEDALS = [
  { ring: "ring-lantern", bg: "bg-lantern/45", label: "1st", height: "h-28" },
  { ring: "ring-parchment-deep", bg: "bg-parchment-deep", label: "2nd", height: "h-20" },
  { ring: "ring-soil", bg: "bg-soil/25", label: "3rd", height: "h-14" },
];

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
    <div className={`transition-opacity duration-200 ${isStale ? "opacity-60" : ""}`} aria-busy={isStale}>
      <PageHeader
        eyebrow={data.range ? rangeLabel(data.range.start, data.range.end) : "Since the beginning"}
        title="Recognition leaderboard"
        subtitle={metric === "given" ? "Ranked by generosity: who's been handing out the most kudos." : "Ranked by kudos received."}
        action={
          <>
            <Segmented
              value={metric}
              onChange={setMetric}
              options={[
                { value: "given", label: "Given" },
                {
                  value: "received",
                  label: (
                    <>
                      {!data.receivedAllowed && <Lock className="h-3 w-3" />}Received
                    </>
                  ),
                  disabled: !data.receivedAllowed,
                  title: data.receivedAllowed ? undefined : "An admin has kept received counts private in this workspace",
                },
              ]}
            />
            <Segmented
              value={period}
              onChange={setPeriod}
              options={PERIOD_OPTIONS}
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {podium.length > 0 && (
            <Card className="relative overflow-hidden">
              <div className="grid grid-cols-3 items-end gap-3 px-4 pt-8 sm:gap-6 sm:px-10">
                {[1, 0, 2].map((idx) => {
                  const r = podium[idx];
                  if (!r) return <div key={idx} />;
                  const m = MEDALS[idx];
                  return (
                    <motion.div
                      key={r.member._id}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + idx * 0.1, type: "spring", bounce: 0.35 }}
                      className="flex flex-col items-center text-center"
                    >
                      {idx === 0 && <div className="mb-1 text-2xl">👑</div>}
                      <Avatar name={r.member.name} src={r.member.avatarUrl} size={idx === 0 ? 76 : 60} ring={clsx("ring-4 ring-offset-4 ring-offset-parchment", m.ring)} />
                      <div className="mt-3 max-w-full truncate font-display text-base font-semibold sm:text-lg">{r.member.name}</div>
                      <div className="text-xs text-ink/75">{r.member.title}</div>
                      <div className="mt-1 font-display text-2xl font-semibold tabular">
                        {nf.format(r.value)} <span className="text-lg">{glyph}</span>
                      </div>
                      <div className={clsx("mt-3 flex w-full items-start justify-center pt-3 tabular text-xs text-ink/75", m.bg, m.height)}>
                        {m.label}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Standings" subtitle={data.previousRange ? `Change compared with ${rangeLabel(data.previousRange.start, data.previousRange.end)}` : undefined} />
            {data.rows.length === 0 ? (
              <Empty icon={glyph} title="No kudos in this period yet">The first person to share some appreciation takes the crown.</Empty>
            ) : (
              <TableScroll>
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="text-left tabular text-[11px] text-ink/65">
                      <th className="w-14 px-3 py-2 font-normal">#</th>
                      <th className="px-3 py-2 font-normal">Teammate</th>
                      <th className="w-48 px-3 py-2 font-normal">Kudos {data.metric}</th>
                      <th className="px-3 py-2 text-right font-normal">Change</th>
                      <th className="px-3 py-2 text-right font-normal" title="Days the daily allowance was fully used">Maxed days</th>
                      <th className="w-12 px-2 py-2 font-normal">
                        <span className="sr-only">Compare</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r, i) => (
                      <motion.tr
                        key={r.member._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.02, 0.4) }}
                        className={clsx("group border-t border-parchment-deep", r.isMe && "bg-lantern/[0.07]")}
                      >
                        <td className="px-3 py-3">
                          <span className={clsx("grid h-7 w-7 place-items-center text-xs tabular", r.rank <= 3 ? "bg-lantern text-ink font-semibold" : "text-ink/75")}>{r.rank}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <FramedAvatar name={r.member.name} src={r.member.avatarUrl} size={32} look={r.member.look} />
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {r.member.name}
                                {r.isMe && <span className="ml-2 bg-lantern/20 px-1.5 py-px tabular text-[10px] text-soil">YOU</span>}
                              </div>
                              {r.member.title && <div className="truncate text-xs text-ink/65">{r.member.title}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <span className="w-8 text-right font-display text-base font-semibold tabular">{nf.format(r.value)}</span>
                            <div className="h-1.5 flex-1 overflow-hidden bg-parchment-deep">
                              <motion.div className="h-full bg-soil" initial={{ width: 0 }} animate={{ width: `${(r.value / max) * 100}%` }} transition={{ duration: 0.7, delay: Math.min(i * 0.02, 0.4) }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Change delta={r.delta} rankChange={r.rankChange} isNew={r.isNew} />
                        </td>
                        <td className="px-3 py-3 text-right tabular text-ink/75">{r.maxedDays > 0 ? <span className="text-ink">{r.maxedDays}</span> : "0"}</td>
                        <td className="px-2 py-3 text-right">
                          {r.comparable && <CompareWith memberId={r.member._id} name={r.member.name} period={period} />}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="relative overflow-hidden p-5">
            <Eyebrow>Kudos shared</Eyebrow>
            <div className="mt-2 flex items-baseline gap-2">
              <BigNumber value={data.highlights.total} className="text-5xl" />
              <span className="text-2xl">{glyph}</span>
            </div>
            <div className="mt-2">
              <Trend cur={data.highlights.total} prev={data.highlights.prevTotal} suffix="vs last period to date" />
            </div>
          </Card>
          <Card className="flex items-center gap-5 p-5">
            <Ring value={data.highlights.participation} color="var(--color-pond)">
              <span className="font-display text-lg font-semibold tabular">{pct(data.highlights.participation)}</span>
            </Ring>
            <div>
              <Eyebrow>Participation</Eyebrow>
              <p className="mt-1 text-sm text-ink/75">
                <b className="text-ink">{data.highlights.givers}</b> of {data.highlights.teamSize} teammates gave kudos
              </p>
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <MiniStat icon={<TrendingUp className="h-4 w-4 text-hedge-deep" />} label="Rising" value={data.highlights.rising} hint="gave more than last period" />
            <MiniStat icon={<Zap className="h-4 w-4 text-soil" />} label="Maxed days" value={data.highlights.maxedDays} hint="full allowance used" />
            <MiniStat icon={<Sparkles className="h-4 w-4 text-r-epic" />} label="Discoveries" value={data.highlights.discoveries} hint="messages unlocked" />
            <MiniStat icon={<Users className="h-4 w-4 text-r-legendary" />} label="Legendary" value={data.highlights.legendaryFinds} hint="legendary finds" />
          </div>
          {data.myRow && (
            <Card className="p-5">
              <Eyebrow>Your position</Eyebrow>
              <div className="mt-2 flex items-center gap-3">
                <Avatar name={viewer.member.name} src={viewer.member.avatarUrl} size={40} />
                <div>
                  <div className="font-display text-2xl font-semibold">#{data.myRow.rank}</div>
                  <div className="text-xs text-ink/75">
                    {data.myRow.value} {glyph} {data.metric}
                  </div>
                </div>
                <div className="ml-auto">
                  <Change delta={data.myRow.delta} rankChange={data.myRow.rankChange} isNew={data.myRow.isNew} />
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/** Row action: a head-to-head with this teammate. Shown on hover or focus with a mouse, always on touch screens. */
function CompareWith({ memberId, name, period }: { memberId: string; name: string; period: Period }) {
  const label = `Compare with ${firstName(name)}`;
  return (
    <Link
      to={compareWithHref(memberId, period)}
      aria-label={label}
      title={label}
      className="inline-grid h-8 w-8 place-items-center text-ink/65 transition hover:bg-parchment-deep/50 hover:text-ink pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100"
    >
      <ArrowLeftRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}

function Change({ delta, rankChange, isNew }: { delta: number | null; rankChange: number | null; isNew: boolean }) {
  if (delta === null) return <span className="text-ink/65">–</span>;
  if (isNew) return <span className="bg-r-epic/15 px-2 py-0.5 tabular text-[11px] text-r-epic">NEW</span>;
  return (
    <span className="inline-flex items-center gap-2">
      {rankChange !== null && rankChange !== 0 && (
        <span className={clsx("inline-flex items-center tabular text-[11px]", rankChange > 0 ? "text-hedge-deep" : "text-ember-deep")} title={`${Math.abs(rankChange)} place${Math.abs(rankChange) === 1 ? "" : "s"} ${rankChange > 0 ? "up" : "down"}`}>
          {rankChange > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {Math.abs(rankChange)}
        </span>
      )}
      <span className={clsx("text-xs tabular", delta > 0 ? "text-hedge-deep" : delta < 0 ? "text-ember-deep" : "text-ink/65")}>
        {delta > 0 ? `+${delta}` : delta === 0 ? "±0" : delta}
      </span>
    </span>
  );
}

function MiniStat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-ink/75">
        {icon}
        {label}
      </div>
      <BigNumber value={value} className="mt-2 block text-3xl" />
      <div className="text-[11px] text-ink/65">{hint}</div>
    </Card>
  );
}
