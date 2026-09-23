import clsx from "clsx";
import { motion } from "motion/react";
import { CalendarDays, Check, Flame, Hash, Heart, Lock, Sparkles, Target, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { Legend, LineChart } from "@/components/charts";
import { MessageText } from "@/components/MessageText";
import { Avatar, BigNumber, Card, CardHeader, Empty, Eyebrow, PageHeader, PageSkeleton, Progress, RarityBadge, Segmented, Trend } from "@/components/ui";
import { dayLabel, firstName, greeting, nf, relativeTime } from "@/lib/format";
import { RARITY_META, type Rarity } from "@/lib/rarity";
import { useStableQuery } from "@/lib/useStableQuery";
import { useViewer } from "@/lib/viewer";

type Period = "7d" | "30d" | "90d";

export function Me() {
  const viewer = useViewer();
  const [period, setPeriod] = useState<Period>("30d");
  const { data, isStale } = useStableQuery(api.me.overview, { period });
  const glyph = viewer.workspace.emojiGlyph;
  if (!data) return <PageSkeleton />;

  const series = [
    { key: "given", label: "Given", color: "var(--color-saffron-deep)", values: data.cadence.map((d) => d.given) },
    ...(viewer.canSeeOwnReceived
      ? [{ key: "received", label: "Received", color: "var(--color-teal)", values: data.cadence.map((d) => d.received) }]
      : []),
    { key: "prevGiven", label: "Given (previous period)", color: "var(--color-saffron-deep)", values: data.cadence.map((d) => d.prevGiven), dashed: true },
  ];

  const weekDelta = data.week.given - data.week.lastWeekGiven;

  return (
    <div className={`transition-opacity duration-200 ${isStale ? "opacity-60" : ""}`} aria-busy={isStale}>
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        title={
          <>
            {greeting()}, {firstName(viewer.member.name)}
          </>
        }
        subtitle={
          data.week.rank
            ? `You're #${data.week.rank} of ${data.week.of} givers this week with ${data.week.given} ${glyph}. ${weekDelta >= 0 ? "Keep it rolling." : "There's still time to catch up."}`
            : `You haven't given kudos this week yet. Who made your week better?`
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AllowanceCard used={data.today.used} limit={data.today.limit} glyph={glyph} />

        <Card className="p-5">
          <Eyebrow>This week</Eyebrow>
          <div className="mt-3 flex items-baseline gap-2">
            <BigNumber value={data.week.rank ? `#${data.week.rank}` : "–"} className="text-5xl" />
            {data.week.rank && <span className="text-sm text-muted">of {data.week.of}</span>}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted">
              <b className="font-semibold text-cream tabular">{data.week.given}</b> given
            </span>
            <Trend cur={data.week.given} prev={data.week.lastWeekGiven} suffix="vs last week" />
          </div>
          <div className="mt-1 font-mono text-[11px] text-faint">
            {dayLabel(data.week.start)} – {dayLabel(data.week.end)}
          </div>
        </Card>

        <Card className="p-5">
          <Eyebrow>All time</Eyebrow>
          <div className="mt-3 flex items-baseline gap-2">
            <BigNumber value={data.totals.given} className="text-5xl" />
            <span className="text-sm text-muted">given</span>
          </div>
          <div className="mt-4 border-t border-line pt-3 text-sm">
            {data.totals.received !== null ? (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-muted">
                  <Heart className="h-3.5 w-3.5 text-teal-soft" /> Received
                </span>
                <b className="font-semibold tabular">{nf.format(data.totals.received)}</b>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-faint">
                <Lock className="h-3.5 w-3.5" /> Received counts are hidden in this workspace
              </div>
            )}
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-muted">Allowance maxed</span>
              <b className="font-semibold tabular">{data.totals.maxedDays} days</b>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <Eyebrow>Messages discovered</Eyebrow>
            <Link to="/discoveries" className="text-xs text-saffron hover:underline">
              Gallery →
            </Link>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <BigNumber value={data.discoveries.discovered} className="text-5xl" />
            <span className="text-sm text-muted">of {data.discoveries.total}</span>
          </div>
          <div className="mt-4 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-panel-3">
            {data.discoveries.byRarity.map((r) => (
              <motion.div
                key={r.rarity}
                title={`${RARITY_META[r.rarity as Rarity].label}: ${r.discovered}/${r.total}`}
                initial={{ width: 0 }}
                animate={{ width: `${(r.discovered / data.discoveries.total) * 100}%` }}
                transition={{ duration: 0.8 }}
                style={{ background: RARITY_META[r.rarity as Rarity].color }}
              />
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
            {data.discoveries.byRarity.map((r) => (
              <span key={r.rarity} className="flex items-center gap-1 font-mono text-[10px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: RARITY_META[r.rarity as Rarity].color }} />
                {r.discovered}/{r.total}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            title="Giving cadence"
            subtitle={
              <>
                {nf.format(data.period.given)} given in the {data.periodLabel.toLowerCase()}{" "}
                {data.period.prevGiven !== null && <Trend cur={data.period.given} prev={data.period.prevGiven} />}
              </>
            }
            action={
              <Segmented
                size="sm"
                value={period}
                onChange={setPeriod}
                options={[
                  { value: "7d", label: "7D" },
                  { value: "30d", label: "30D" },
                  { value: "90d", label: "90D" },
                ]}
              />
            }
          />
          <div className="px-5 pb-5">
            <Legend items={series.map((s) => ({ label: s.label, color: s.color, dashed: s.dashed }))} />
            <div className="mt-3">
              <LineChart days={data.cadence.map((d) => d.day)} series={series} height={340} />
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader title="Recognition patterns" subtitle={data.periodLabel} />
          <ul className="divide-y divide-line px-5">
            <Pattern icon={<Users className="h-4 w-4" />} label="Teammates celebrated" value={data.patterns.teammatesCelebrated} />
            <Pattern icon={<Hash className="h-4 w-4" />} label="Channels visited" value={data.patterns.channelsVisited} />
            <Pattern icon={<Flame className="h-4 w-4" />} label="Longest giving streak" value={data.patterns.longestStreak ? `${data.patterns.longestStreak} days` : "–"} hint={data.patterns.currentStreak ? `${data.patterns.currentStreak} day streak running` : undefined} />
            <Pattern icon={<CalendarDays className="h-4 w-4" />} label="Most generous on" value={data.patterns.bestWeekday ?? "–"} />
            <Pattern icon={<Heart className="h-4 w-4" />} label="You celebrate most" value={data.patterns.topRecipient ? firstName(data.patterns.topRecipient.name) : "–"} hint={data.patterns.topRecipient ? `${data.patterns.topRecipient.amount} ${glyph}` : undefined} />
            {data.patterns.topSupporter && (
              <Pattern icon={<Sparkles className="h-4 w-4" />} label="Your biggest fan" value={firstName(data.patterns.topSupporter.name)} hint={`${data.patterns.topSupporter.amount} ${glyph}`} />
            )}
          </ul>
          <div className="mx-5 mb-5 mt-2 rounded-xl border border-line bg-ink/50 p-4">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>You vs. team median</span>
              <span className="font-mono tabular">
                {data.period.given} vs {Math.round(data.period.teamMedian)}
              </span>
            </div>
            <CompareBars mine={data.period.given} team={data.period.teamMedian} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader title="Weekly quests" subtitle={`${data.quests.filter((q) => q.done).length} of ${data.quests.length} complete · resets Monday`} icon={<Target className="h-4 w-4 text-saffron" />} />
          <ul className="space-y-2 px-5 pb-5">
            {data.quests.map((q) => (
              <li key={q.id} className={clsx("rounded-xl border p-3.5 transition-colors", q.done ? "border-up/25 bg-up/[0.06]" : "border-line bg-ink/40")}>
                <div className="flex items-start gap-3">
                  <span className={clsx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full", q.done ? "bg-up text-ink" : "border border-line-strong")}>
                    {q.done && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{q.title}</span>
                      <span className="font-mono text-xs text-muted tabular">
                        {q.progress}/{q.goal}
                      </span>
                    </div>
                    <p className="text-xs text-muted">{q.description}</p>
                    {!q.done && <Progress value={q.progress} max={q.goal} className="mt-2" height={4} />}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-7">
          <CardHeader title="Recent activity" subtitle={viewer.canSeeOwnReceived ? "Kudos you gave and received" : "Kudos you gave"} />
          {data.activity.length === 0 ? (
            <Empty icon={glyph} title="Nothing here yet">
              Mention a teammate with {glyph} in Slack and it'll show up here.
            </Empty>
          ) : (
            <ul className="px-2 pb-3">
              {data.activity.map((a) => (
                <li key={a._id} className="flex gap-3 rounded-xl px-3 py-3 hover:bg-panel-2/60">
                  <Avatar name={a.other?.name ?? "?"} src={a.other?.avatarUrl} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 text-sm">
                      {a.direction === "given" ? (
                        <span>
                          You gave <b className="font-semibold">{a.other?.name}</b>
                        </span>
                      ) : (
                        <span>
                          <b className="font-semibold">{a.other?.name}</b> gave you
                        </span>
                      )}
                      <span className={clsx("rounded-full px-2 py-px font-mono text-[11px]", a.direction === "given" ? "bg-saffron/15 text-saffron" : "bg-teal/20 text-teal-soft")}>
                        {a.direction === "given" ? "−" : "+"}
                        {a.amount} {glyph}
                      </span>
                      {a.channel && <span className="font-mono text-xs text-faint">#{a.channel}</span>}
                      <span className="ml-auto text-xs text-faint">{relativeTime(a.at)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">{a.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader
            title="Latest discoveries"
            subtitle="The rarest messages you've uncovered recently"
            action={
              <Link to="/discoveries" className="text-sm text-saffron hover:underline">
                {data.discoveries.total - data.discoveries.discovered} still hidden →
              </Link>
            }
          />
          {data.discoveries.latest.length === 0 ? (
            <Empty icon="🔒" title="No discoveries yet">Give or receive kudos in Slack to unlock your first message.</Empty>
          ) : (
            <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2">
              {data.discoveries.latest.map((d, i) => (
                <motion.div
                  key={d.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className={clsx("rounded-2xl bg-ink/60 p-4 ring-1 ring-inset", RARITY_META[d.rarity as Rarity].ring, RARITY_META[d.rarity as Rarity].glow)}
                >
                  <RarityBadge rarity={d.rarity as Rarity} size="xs" />
                  <p className="mt-3 text-sm leading-relaxed">
                    “<MessageText text={d.text} emoji={glyph} />”
                  </p>
                  <div className="mt-3 font-mono text-[10px] text-faint">
                    Seen {d.timesSeen}× · first {relativeTime(d.firstSeenAt)}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader title="From the Kudos bot" subtitle="Latest messages sent to you in Slack" />
          {data.botMessages.length === 0 ? (
            <Empty icon="💬" title="No messages yet" />
          ) : (
            <ul className="space-y-2 px-5 pb-5">
              {data.botMessages.map((m) => (
                <li key={m._id} className="rounded-xl border border-line bg-ink/40 p-3.5">
                  <p className="text-sm leading-relaxed">{m.text}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <RarityBadge rarity={m.rarity as Rarity} size="xs" />
                    {m.isNewDiscovery && <span className="text-xs text-saffron">✨ New discovery</span>}
                    <span className="ml-auto text-xs text-faint">{relativeTime(m.at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function AllowanceCard({ used, limit, glyph }: { used: number; limit: number; glyph: string }) {
  const remaining = Math.max(0, limit - used);
  return (
    <Card className="grain overflow-hidden bg-gradient-to-br from-saffron/[0.16] via-panel to-panel p-5">
      <Eyebrow>Daily allowance</Eyebrow>
      <div className="mt-3 flex items-baseline gap-2">
        <BigNumber value={remaining} className="text-5xl" />
        <span className="text-sm text-muted">left today</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5" aria-label={`${remaining} of ${limit} left`}>
        {Array.from({ length: limit }).map((_, i) => (
          <motion.span
            key={i}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: i < remaining ? 1 : 0.18 }}
            transition={{ delay: i * 0.05, type: "spring", bounce: 0.5 }}
            className={clsx("text-2xl", i >= remaining && "grayscale")}
          >
            {glyph}
          </motion.span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Used {used} of {limit} · resets at midnight
      </p>
    </Card>
  );
}

function Pattern({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-panel-2 text-muted">{icon}</span>
      <span className="flex-1 text-sm text-muted">{label}</span>
      <span className="text-right">
        <span className="block font-display text-base font-semibold tabular">{value}</span>
        {hint && <span className="block text-[11px] text-faint">{hint}</span>}
      </span>
    </li>
  );
}

function CompareBars({ mine, team }: { mine: number; team: number }) {
  const max = Math.max(1, mine, team);
  return (
    <div className="mt-3 space-y-2">
      {[
        { label: "You", value: mine, color: "var(--color-saffron-deep)" },
        { label: "Team", value: team, color: "var(--color-faint)" },
      ].map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-10 text-xs text-muted">{r.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-3">
            <motion.div className="h-full rounded-full" style={{ background: r.color }} initial={{ width: 0 }} animate={{ width: `${(r.value / max) * 100}%` }} transition={{ duration: 0.8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
