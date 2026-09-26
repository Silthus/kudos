import { Info } from "lucide-react";
import { useState, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import { BarChart, BarList, DataTable, Heatmap, Legend } from "@/components/charts";
import { Padlock } from "@/components/Padlock";
import { SuccessMetrics } from "@/components/SuccessMetrics";
import { Avatar, BigNumber, Card, CardHeader, Empty, Eyebrow, PageSkeleton, Progress, Segmented, Trend } from "@/components/ui";
import { dayLabel, nf, pct, rangeLabel } from "@/lib/format";
import { DEFAULT_PERIOD, PERIOD_OPTIONS, useWorkspaceToday, type Period } from "@/lib/period";
import { RARITY_META, type Rarity } from "@/lib/rarity";
import { useStableQuery } from "@/lib/useStableQuery";
import { useViewer } from "@/lib/viewer";

type Dial = { label: string; value: string; meter: number | null; trend: ReactNode; hint: string };

/**
 * The observatory (#126, #132): how recognition flows through the team, read off brass dials and
 * charts in the observatory's window. Admins also see the game's success metrics.
 */
export function Analytics() {
  const viewer = useViewer();
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const today = useWorkspaceToday();
  const { data, isStale } = useStableQuery(api.analytics.overview, { period, today });
  if (!data) return <PageSkeleton />;
  const k = data.kpis;
  const glyph = data.unit.glyph;

  // Givers are compared with the whole previous period: distinct people can't be counted "to date".
  // Worded from the data on screen: it lags `period` while a switch loads.
  const lastPeriod = data.period === "all" ? null : `last ${data.period}`;
  // Rates get a meter from none to all of it; counts have no natural full, so they show their trend.
  const dials: Dial[] = [
    { label: "Kudos given", value: nf.format(k.total), meter: null, trend: <Trend cur={k.total} prev={k.prevTotal} suffix="vs prev. to date" />, hint: `${nf.format(k.messages)} recognition moments` },
    { label: "Participation", value: pct(k.participation), meter: k.participation, trend: k.prevParticipation !== null && lastPeriod ? <span className="text-xs text-ink/70 tabular">{pct(k.prevParticipation)} in all of {lastPeriod}</span> : null, hint: `${k.givers} of ${k.teamSize} teammates gave` },
    { label: "Avg. per giver", value: k.avgPerGiver.toFixed(1), meter: null, trend: null, hint: `${k.receivers} people were recognized` },
    { label: "Allowance used", value: pct(k.allowanceUse), meter: k.allowanceUse, trend: null, hint: `on active days, with ${k.maxedDays} maxed ${k.maxedDays === 1 ? "day" : "days"}` },
    { label: "Top-20% share", value: pct(k.topShare), meter: null, trend: null, hint: "of kudos come from the most generous fifth" },
    { label: "New givers", value: nf.format(k.newGivers), meter: null, trend: null, hint: k.prevGivers !== null && lastPeriod ? `${k.retained} of ${lastPeriod}'s ${k.prevGivers} givers kept giving` : "everyone who has ever given" },
  ];
  const monthly = data.grain === "month";
  const hasCompare = data.volume.length > 0 && data.volume[0].prevTotal !== null;
  const volumeLabel = (d: string) => (monthly ? dayLabel(d, { month: "short", year: "numeric" }) : dayLabel(d, { weekday: "short", month: "short", day: "numeric" }));
  const person = (m: { name: string; avatarUrl?: string | null } | null) => (
    <span className="flex items-center gap-2">
      <Avatar name={m?.name ?? "?"} src={m?.avatarUrl} size={22} />
      <span data-user-text>{m?.name}</span>
    </span>
  );

  return (
    <div className={`space-y-4 ${isStale ? "[&_.pixel-frame>*]:opacity-60 [&_[data-dial]]:opacity-60" : ""}`} aria-busy={isStale}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{rangeLabel(data.range.start, data.range.end)}</p>
          <p className="text-sm text-ink/75">How recognition flows through the team: who takes part, when, and where.</p>
        </div>
        <Segmented label="Period" size="sm" value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
      </div>

      <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3">
        {dials.map((t) => (
          <div key={t.label} data-dial className="border-2 border-soil bg-lantern/10 p-3 @lg:p-4">
            <Eyebrow>{t.label}</Eyebrow>
            <BigNumber value={t.value} className="mt-1 block text-3xl" />
            <div className="mt-2 min-h-4">{t.meter !== null ? <Progress value={t.meter} max={1} label={t.label} /> : t.trend}</div>
            {t.meter !== null && t.trend && <div className="mt-1">{t.trend}</div>}
            <p className="mt-1 text-xs text-ink/70">{t.hint}</p>
          </div>
        ))}
      </div>

      <Card id="volume">
        <CardHeader
          title={monthly ? "Monthly volume" : "Daily volume"}
          subtitle={`Kudos given per ${monthly ? "month" : "day"}, ${data.label.toLowerCase()}`}
          action={hasCompare ? <Legend items={[{ label: "This period", color: "var(--color-ember)" }, { label: "Previous period to date", color: "var(--color-benchmark)", dashed: true }]} /> : null}
        />
        <div className="px-3 pb-4 @lg:px-5">
          <BarChart grain={data.grain} days={data.volume.map((d) => d.day)} values={data.volume.map((d) => d.total)} compare={hasCompare ? data.volume.map((d) => d.prevTotal) : null} height={220} />
          <DataTable caption={monthly ? "Kudos given per month" : "Kudos given per day"}>
            <thead>
              <tr className="text-left tabular text-[10px] text-ink/70">
                <th className="py-1.5 font-normal">{monthly ? "Month" : "Day"}</th>
                <th className="py-1.5 text-right font-normal">Kudos</th>
                {hasCompare && <th className="py-1.5 pl-3 text-right font-normal">Previous period</th>}
              </tr>
            </thead>
            <tbody>
              {data.volume.map((d) => (
                <tr key={d.day} className="border-t border-parchment-deep">
                  <td className="py-1.5 text-ink/75">{volumeLabel(d.day)}</td>
                  <td className="py-1.5 text-right text-ink tabular">{nf.format(d.total)}</td>
                  {hasCompare && <td className="py-1.5 pl-3 text-right text-ink/75 tabular">{d.prevTotal === null ? "" : nf.format(d.prevTotal)}</td>}
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </Card>

      <Card>
        <CardHeader title="When recognition happens" subtitle={`Kudos by weekday and hour, in ${viewer.workspace.timezone} time`} />
        <div className="px-3 pb-4 @lg:px-5">
          <Heatmap data={data.heatmap} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Where it happens" subtitle="Top channels" />
        <div className="px-5 pb-5">
          {data.channels.length ? <BarList items={data.channels.map((c) => ({ key: c.name, label: `#${c.name}`, value: c.value }))} /> : <Empty title="No channel activity yet" />}
          {data.sources.length > 0 && (
            <div className="mt-5 flex gap-3">
              {data.sources.map((s) => (
                <div key={s.name} className="min-w-0 flex-1 border border-parchment-deep bg-parchment-deep/40 px-3 py-2">
                  <div className="text-xs text-ink/75">{s.name}</div>
                  <div className="font-display text-xl font-semibold tabular">{nf.format(s.value)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 items-start gap-4 @2xl:grid-cols-2">
        <Card>
          <CardHeader title="Most generous" subtitle="Kudos given" />
          <div className="px-5 pb-5">
            {data.topGivers.length ? (
              <BarList items={data.topGivers.map((g) => ({ key: g.member?._id ?? "?", label: person(g.member), value: g.value }))} />
            ) : (
              <Empty title="Nobody has given kudos in this period yet" />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Most recognized" subtitle="Kudos received" />
          <div className="px-5 pb-5">
            {data.topReceivers ? (
              <BarList color="var(--color-pond)" items={data.topReceivers.map((g) => ({ key: g.member?._id ?? "?", label: person(g.member), value: g.value }))} />
            ) : (
              <PrivateNote />
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Strongest connections" subtitle="Who thanks whom most" />
        <div className="px-5 pb-5">
          {data.topPairs ? (
            <ul className="divide-y divide-parchment-deep border-y border-parchment-deep">
              {data.topPairs.map((p, i) => (
                <li key={i} className="flex min-w-0 items-center gap-2 py-2 text-sm">
                  <Avatar name={p.giver?.name ?? "?"} src={p.giver?.avatarUrl} size={24} />
                  <span className="min-w-0 truncate">
                    <b className="font-semibold">{p.giver?.name.split(" ")[0]}</b> thanked <b className="font-semibold">{p.receiver?.name.split(" ")[0]}</b>
                  </span>
                  <Avatar name={p.receiver?.name ?? "?"} src={p.receiver?.avatarUrl} size={24} />
                  <span className="ml-auto shrink-0 text-xs text-ink/75 tabular">
                    {nf.format(p.value)} <span data-user-text>{glyph}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <PrivateNote />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Messages discovered" subtitle="New bot messages unlocked across the team, by rarity" />
        <div className="grid grid-cols-2 gap-3 px-5 pb-5 @lg:grid-cols-5">
          {data.rarity.map((r) => (
            <div key={r.rarity} className="border border-parchment-deep bg-parchment-deep/40 p-3">
              <div className="flex items-center gap-2 text-xs text-ink/75">
                <span className="h-2 w-2" style={{ background: RARITY_META[r.rarity as Rarity].color }} />
                {RARITY_META[r.rarity as Rarity].label}
              </div>
              <div className="mt-1 font-display text-2xl font-semibold tabular">{nf.format(r.value)}</div>
            </div>
          ))}
        </div>
      </Card>
      {data.truncated && (
        <p className="flex items-center gap-1.5 text-xs text-ink/70">
          <Info className="h-3.5 w-3.5 shrink-0" /> This range is very busy: some charts only include the most recent activity.
        </p>
      )}
      {viewer.member.isAdmin && <SuccessMetrics today={today} />}
    </div>
  );
}

/** Why a list of people is missing: a footnote on the window's parchment, under a padlock. */
function PrivateNote() {
  return (
    <p data-footnote className="flex items-start gap-2 border-t border-parchment-deep pt-3 text-xs text-ink/70">
      <span className="mt-0.5 text-ink">
        <Padlock />
      </span>
      Received kudos are private in this workspace. Admins can change this in settings.
    </p>
  );
}
