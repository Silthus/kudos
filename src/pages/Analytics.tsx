import { ArrowRight, Info, Lock } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { BarChart, BarList, Heatmap, Legend } from "@/components/charts";
import { Avatar, BigNumber, Card, CardHeader, Empty, Eyebrow, PageHeader, PageSkeleton, Segmented, Trend } from "@/components/ui";
import { nf, pct, rangeLabel } from "@/lib/format";
import { DEFAULT_PERIOD, PERIOD_OPTIONS, useWorkspaceToday, type Period } from "@/lib/period";
import { RARITY_META, type Rarity } from "@/lib/rarity";
import { useStableQuery } from "@/lib/useStableQuery";
import { useViewer } from "@/lib/viewer";

export function Analytics() {
  const viewer = useViewer();
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const today = useWorkspaceToday();
  const { data, isStale } = useStableQuery(api.analytics.overview, { period, today });
  if (!data) return <PageSkeleton />;
  const k = data.kpis;
  const glyph = data.unit.glyph;

  const tiles = [
    { label: "Kudos given", value: nf.format(k.total), trend: <Trend cur={k.total} prev={k.prevTotal} />, hint: `${nf.format(k.messages)} recognition moments` },
    { label: "Participation", value: pct(k.participation), trend: k.prevParticipation !== null ? <Trend cur={Math.round(k.participation * 100)} prev={Math.round(k.prevParticipation * 100)} /> : null, hint: `${k.givers} of ${k.teamSize} teammates gave` },
    { label: "Avg. per giver", value: k.avgPerGiver.toFixed(1), trend: null, hint: `${k.receivers} people were recognized` },
    { label: "Allowance used", value: pct(k.allowanceUse), trend: null, hint: `on active days · ${k.maxedDays} maxed days` },
    { label: "Top-20% share", value: pct(k.topShare), trend: null, hint: "of kudos come from the most generous fifth" },
    { label: "New givers", value: nf.format(k.newGivers), trend: null, hint: `${k.retained} kept giving from last period` },
  ];

  return (
    <div className={`transition-opacity duration-200 ${isStale ? "opacity-60" : ""}`} aria-busy={isStale}>
      <PageHeader
        eyebrow={rangeLabel(data.range.start, data.range.end)}
        title="Team analytics"
        subtitle="How recognition flows through the organization: who takes part, when it happens, and where."
        action={
          <Segmented
            value={period}
            onChange={setPeriod}
            options={PERIOD_OPTIONS}
          />
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        {tiles.map((t) => (
          <Card key={t.label} className="p-5">
            <Eyebrow>{t.label}</Eyebrow>
            <BigNumber value={t.value} className="mt-2 block text-4xl" />
            <div className="mt-2 min-h-5">{t.trend}</div>
            <p className="mt-1 text-xs text-faint">{t.hint}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader title="Daily volume" subtitle={`Kudos given per day, ${data.label.toLowerCase()}`} action={<Legend items={[{ label: "This period", color: "var(--color-saffron-deep)" }, ...(data.daily[0]?.prevTotal !== null ? [{ label: "Previous period to date", color: "var(--color-muted)", dashed: true }] : [])]} />} />
        <div className="px-5 pb-5">
          <BarChart days={data.daily.map((d) => d.day)} values={data.daily.map((d) => d.total)} compare={data.daily[0]?.prevTotal !== null ? data.daily.map((d) => d.prevTotal) : null} height={260} />
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader title="When recognition happens" subtitle={`Kudos by weekday and hour · ${viewer.workspace.timezone}`} />
          <div className="px-5 pb-5">
            <Heatmap data={data.heatmap} />
          </div>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader title="Where it happens" subtitle="Top channels" />
          <div className="px-5 pb-5">
            {data.channels.length ? <BarList items={data.channels.map((c) => ({ key: c.name, label: `#${c.name}`, value: c.value }))} /> : <Empty title="No channel activity yet" />}
            {data.sources.length > 0 && (
              <div className="mt-6 flex gap-3">
                {data.sources.map((s) => (
                  <div key={s.name} className="flex-1 rounded-xl border border-line bg-ink/40 px-4 py-3">
                    <div className="text-xs text-muted">{s.name}</div>
                    <div className="font-display text-xl font-semibold tabular">{nf.format(s.value)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Most generous" subtitle="Kudos given" />
          <div className="px-5 pb-5">
            <BarList
              items={data.topGivers.map((g) => ({
                key: g.member?._id ?? "?",
                label: (
                  <span className="flex items-center gap-2">
                    <Avatar name={g.member?.name ?? "?"} src={g.member?.avatarUrl} size={22} />
                    {g.member?.name}
                  </span>
                ),
                value: g.value,
              }))}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Most recognized" subtitle="Kudos received" />
          <div className="px-5 pb-5">
            {data.topReceivers ? (
              <BarList
                color="var(--color-teal)"
                items={data.topReceivers.map((g) => ({
                  key: g.member?._id ?? "?",
                  label: (
                    <span className="flex items-center gap-2">
                      <Avatar name={g.member?.name ?? "?"} src={g.member?.avatarUrl} size={22} />
                      {g.member?.name}
                    </span>
                  ),
                  value: g.value,
                }))}
              />
            ) : (
              <PrivateNote />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Strongest connections" subtitle="Who recognizes whom most" />
          <div className="px-5 pb-5">
            {data.topPairs ? (
              <ul className="space-y-2">
                {data.topPairs.map((p, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-xl border border-line bg-ink/40 px-3 py-2 text-sm">
                    <Avatar name={p.giver?.name ?? "?"} src={p.giver?.avatarUrl} size={24} />
                    <span className="truncate">{p.giver?.name.split(" ")[0]}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-faint" />
                    <Avatar name={p.receiver?.name ?? "?"} src={p.receiver?.avatarUrl} size={24} />
                    <span className="truncate">{p.receiver?.name.split(" ")[0]}</span>
                    <span className="ml-auto font-mono text-xs text-muted tabular">
                      {p.value} {glyph}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <PrivateNote />
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Messages discovered" subtitle="New bot messages unlocked across the team, by rarity" />
        <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-5">
          {data.rarity.map((r) => (
            <div key={r.rarity} className="rounded-xl border border-line bg-ink/40 p-4">
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: RARITY_META[r.rarity as Rarity].color }} />
                {RARITY_META[r.rarity as Rarity].label}
              </div>
              <div className="mt-1 font-display text-2xl font-semibold tabular">{nf.format(r.value)}</div>
            </div>
          ))}
        </div>
      </Card>
      {data.truncated && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-faint">
          <Info className="h-3.5 w-3.5" /> This range is very busy: some charts only include the most recent activity.
        </p>
      )}
    </div>
  );
}

function PrivateNote() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-ink/40 p-4 text-sm text-muted">
      <Lock className="mt-0.5 h-4 w-4 shrink-0" />
      Received kudos are private in this workspace. Admins can change this in settings.
    </div>
  );
}
