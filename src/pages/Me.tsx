import clsx from "clsx";
import { useQuery } from "convex/react";
import { motion } from "motion/react";
import { CalendarDays, ChevronRight, Flame, Hash, Heart, Lock, Sparkles, Target, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { Legend, LineChart } from "@/components/charts";
import { MessageText } from "@/components/MessageText";
import { QUEST_RULES, QuestBoardBody } from "@/components/quests";
import { GainLines, GameCard, LevelUpHoggie, ScoutHints } from "@/components/game";
import { LookCard } from "@/components/cosmetics";
import { Avatar, BigNumber, Card, CardHeader, Empty, Eyebrow, PageHeader, PageSkeleton, RarityBadge, Segmented, Trend } from "@/components/ui";
import { compareTeamHref } from "@/lib/compare";
import { dayLabel, firstName, greeting, nf, relativeTime } from "@/lib/format";
import { DEFAULT_PERIOD, PERIOD_OPTIONS, useWorkspaceToday, type Period } from "@/lib/period";
import { RARITY_META, type Rarity } from "@/lib/rarity";
import { useStableQuery } from "@/lib/useStableQuery";
import { useViewer } from "@/lib/viewer";
import { StoreBalanceChip } from "./Store";

export function Me() {
  const viewer = useViewer();
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const today = useWorkspaceToday();
  // My own numbers change with my activity (and the few teammates it names); my standing changes
  // with every give in the workspace, so it is a separate, small subscription the page doesn't
  // wait for.
  const { data, isStale } = useStableQuery(api.me.overview, { period, today });
  const { data: standing, isStale: standingStale } = useStableQuery(api.me.standing, { period, today });
  const glyph = viewer.workspace.emojiGlyph;
  if (!data) return <PageSkeleton />;
  const rank = standing?.week.rank ?? null;

  const series = [
    { key: "given", label: "Given", color: "var(--color-saffron-deep)", values: data.cadence.map((d) => d.given) },
    ...(viewer.canSeeOwnReceived
      ? [{ key: "received", label: "Received", color: "var(--color-teal)", values: data.cadence.map((d) => d.received) }]
      : []),
    ...(data.period.prevGiven !== null
      ? [{ key: "prevGiven", label: "Given (previous period to date)", color: "var(--color-saffron-deep)", values: data.cadence.map((d) => d.prevGiven), dashed: true }]
      : []),
  ];

  const weekDelta = data.week.given - data.week.lastWeekGiven;

  return (
    <div className={`transition-opacity duration-200 ${isStale || standingStale ? "opacity-60" : ""}`} aria-busy={isStale || standingStale}>
      <PageHeader
        eyebrow={dayLabel(today, { weekday: "long", month: "long", day: "numeric" })}
        title={
          <>
            {greeting()}, {firstName(viewer.member.name)}
          </>
        }
        subtitle={
          !standing
            ? `You've given ${data.week.given} ${glyph} this week.`
            : rank
              ? `You're #${rank} of ${standing.week.of} givers this week with ${data.week.given} ${glyph}. ${weekDelta >= 0 ? "Keep it rolling." : "There's still time to catch up."}`
              : `You haven't given kudos this week yet. Who made your week better?`
        }
      />

      <div className="mb-4 flex flex-col gap-4">
        <GameCard glyph={glyph} />
        <LookCard memberId={viewer.member._id} today={today} />
        <ScoutHints today={today} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AllowanceCard used={data.today.used} limit={data.today.limit} glyph={glyph} />

        <Card className="p-5">
          <Eyebrow>This week</Eyebrow>
          <div className="mt-3 flex items-baseline gap-2">
            <BigNumber value={rank ? `#${rank}` : "–"} className={`text-5xl ${standing ? "" : "animate-pulse text-faint"}`} />
            {rank && standing && <span className="text-sm text-muted">of {standing.week.of}</span>}
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
                {nf.format(data.period.given)} given {data.periodLabel.toLowerCase()}{" "}
                {data.period.prevGiven !== null && <Trend cur={data.period.given} prev={data.period.prevGiven} />}
              </>
            }
            action={<Segmented size="sm" value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
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
                {data.period.given} vs {standing ? Math.round(standing.teamMedian) : "–"}
              </span>
            </div>
            <CompareBars mine={data.period.given} team={standing?.teamMedian ?? 0} />
            <Link to={compareTeamHref(period)} className="mt-3 inline-block text-xs text-saffron hover:underline">
              Compare in detail →
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        {viewer.workspace.questsEnabled && <QuestCard today={today} />}

        <Card className={viewer.workspace.questsEnabled ? "xl:col-span-7" : "xl:col-span-12"}>
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
                <li key={m._id} className="flow-root rounded-xl border border-line bg-ink/40 p-3.5">
                  <LevelUpHoggie label={m.gainLabel} />
                  <p className="text-sm leading-relaxed whitespace-pre-line">{m.text}</p>
                  <GainLines lines={m.gains} />
                  <div className="mt-2 flex items-center gap-2">
                    {m.category === "gains" || m.category === "level_up" || m.category === "garden" ? (
                      <span className="text-xs font-medium text-saffron">{m.gainLabel ?? "Level up"}</span>
                    ) : (
                      <RarityBadge rarity={m.rarity as Rarity} size="xs" />
                    )}
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

/** This week's quest board (quests.mine): progress, waived quests, how quests count, and the way to the log. */
function QuestCard({ today }: { today: string }) {
  const board = useQuery(api.quests.mine, { today });
  if (board === undefined) return <Card className="min-h-64 animate-pulse xl:col-span-5" aria-busy />;
  if (!board.enabled) return null;
  return (
    <Card className="flex flex-col xl:col-span-5 xl:self-start">
      <CardHeader
        title="Weekly quests"
        subtitle={
          board.locked
            ? `Opens at level ${board.locked.level}`
            : board.available > 0
              ? `${board.completed} of ${board.available} complete · resets Monday`
              : "Nothing to do this week · resets Monday"
        }
        icon={<Target className="h-4 w-4 text-saffron" />}
        action={
          board.sweep && (
            <span className="rounded-full bg-up/15 px-2.5 py-1 text-xs font-medium text-up">Clean sweep 🧹</span>
          )
        }
      />
      <div className="px-5">
        <QuestBoardBody board={board} />
      </div>
      <details className="group mx-5 mt-3 rounded-xl border border-line bg-ink/30 px-3.5 py-2.5 text-xs text-muted">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-cream/80 select-none [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" /> How quests count
        </summary>
        <ul className="mt-2 space-y-1 pl-5 leading-relaxed">
          {QUEST_RULES.map((rule, i) => (
            <li key={i}>{rule}</li>
          ))}
        </ul>
      </details>
      <Link to="/quests" className="mx-5 mt-3 mb-5 self-end text-sm font-medium text-saffron underline-offset-4 hover:underline">
        Quest log →
      </Link>
    </Card>
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
      <StoreBalanceChip className="mt-3" />
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
