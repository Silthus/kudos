import clsx from "clsx";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { CalendarDays, ChevronRight, Flame, Hash, Heart, Lock, LogOut, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Legend, LineChart } from "@/components/charts";
import { HogCoin } from "@/components/HogCoin";
import { MessageText } from "@/components/MessageText";
import { QUEST_RULES, QuestBoardBody } from "@/components/quests";
import { GainLines, GameCard, GameSwitch, LevelUpHoggie, ScoutHints } from "@/components/game";
import { LookCard } from "@/components/cosmetics";
import { Room } from "@/components/room";
import { Avatar, BigNumber, Empty, meterFill, PageSkeleton, RarityBadge, Segmented, Trend } from "@/components/ui";
import { HEDGEHOG_MODE } from "@/lib/art";
import { compareTeamHref } from "@/lib/compare";
import { dayLabel, firstName, greeting, nf, relativeTime } from "@/lib/format";
import { DEFAULT_PERIOD, PERIOD_OPTIONS, useWorkspaceToday, type Period } from "@/lib/period";
import { RARITY_META, type Rarity } from "@/lib/rarity";
import { useStableQuery } from "@/lib/useStableQuery";
import { useViewer } from "@/lib/viewer";

const linkCls = "font-semibold text-ember-deep underline decoration-2 underline-offset-4";

/**
 * Your cabin (#126, #130): the window of the place that's yours. One column of rooms on the
 * window's parchment: you (level, coins, today's kudos), your giving, your look, lately, what
 * you found, the bot's messages, this week's quests, and the door (the game's switch, workspaces,
 * sign out). It lays out by the window's width (`@md:`), never the screen's.
 */
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
  const weekDelta = data.week.given - data.week.lastWeekGiven;

  return (
    <div className={clsx("space-y-8", (isStale || standingStale) && "[&_section>*]:opacity-60")} aria-busy={isStale || standingStale}>
      <p className="text-[15px] leading-6">
        <span className="font-display text-xl font-medium">
          {greeting()}, {firstName(viewer.member.name)}.
        </span>{" "}
        {!standing
          ? `You've given ${data.week.given} ${glyph} this week.`
          : rank
            ? `You're number ${rank} of ${standing.week.of} givers this week with ${data.week.given} ${glyph}. ${weekDelta >= 0 ? "Keep it rolling." : "There's still time to catch up."}`
            : "You haven't given kudos this week yet. Who made your week better?"}
      </p>

      <Room title="You">
        <div className="space-y-5">
          <GameCard glyph={glyph} />
          <Allowance used={data.today.used} limit={data.today.limit} glyph={glyph} />
          <StoreWay />
          <ScoutHints today={today} />
        </div>
      </Room>

      <Room title="Your giving" action={<Segmented size="sm" value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />}>
        <YourGiving data={data} standing={standing ?? null} period={period} glyph={glyph} />
      </Room>

      <LookCard memberId={viewer.member._id} today={today} />

      <Room title="Lately" subtitle={viewer.canSeeOwnReceived ? "Kudos you gave and received" : "Kudos you gave"}>
        {data.activity.length === 0 ? (
          <Empty title="Nothing here yet">Mention a teammate with {glyph} in Slack and it shows up here.</Empty>
        ) : (
          <ul>
            {data.activity.map((a) => (
              <li key={a._id} className="flex gap-3 border-t border-parchment-deep py-3 first:border-t-0">
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
                    <span className={clsx("pixel-chip px-1.5 tabular text-[11px] font-semibold", a.direction === "given" ? "bg-lantern/30" : "bg-pond/25")}>
                      {a.direction === "given" ? "−" : "+"}
                      {a.amount} {glyph}
                    </span>
                    {a.channel && <span className="tabular text-xs text-ink/70">#{a.channel}</span>}
                    <span className="ml-auto text-xs text-ink/70">{relativeTime(a.at)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-ink/75">{a.text}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Room>

      <Room
        title="Found lately"
        subtitle={`${data.discoveries.discovered} of ${data.discoveries.total} messages found, ${data.discoveries.total - data.discoveries.discovered} still hidden`}
        action={
          <Link to="/discoveries" className={clsx(linkCls, "text-sm")}>
            Open the gallery
          </Link>
        }
      >
        <RarityBar byRarity={data.discoveries.byRarity} total={data.discoveries.total} />
        {data.discoveries.latest.length === 0 ? (
          <Empty title="No discoveries yet">Give or receive kudos in Slack to find your first message.</Empty>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 @md:grid-cols-2">
            {data.discoveries.latest.map((d) => (
              <div key={d.key} className="pixel-note p-4">
                <RarityBadge rarity={d.rarity as Rarity} size="xs" />
                <p className="mt-3 text-sm leading-relaxed">
                  “<MessageText text={d.text} emoji={glyph} />”
                </p>
                <div className="mt-3 text-[11px] text-ink/70">
                  Seen {d.timesSeen} {d.timesSeen === 1 ? "time" : "times"}, first {relativeTime(d.firstSeenAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Room>

      <Room title="From the bot" subtitle="The latest the Kudos bot sent you in Slack">
        {data.botMessages.length === 0 ? (
          <Empty title="Nothing from the bot yet" />
        ) : (
          <ul className="space-y-3">
            {data.botMessages.map((m) => (
              <li key={m._id} className="pixel-note flow-root p-3.5">
                <LevelUpHoggie label={m.gainLabel} category={m.category} />
                <p className="text-sm leading-relaxed whitespace-pre-line">{m.text}</p>
                <GainLines lines={m.gains} />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {m.category === "gains" || m.category === "level_up" || m.category === "garden" ? (
                    <span className="text-xs font-semibold text-soil">{m.gainLabel ?? "Level up"}</span>
                  ) : (
                    <RarityBadge rarity={m.rarity as Rarity} size="xs" />
                  )}
                  {m.isNewDiscovery && <span className="pixel-chip bg-lantern/30 px-1.5 text-[11px] font-semibold">New discovery</span>}
                  <span className="ml-auto text-xs text-ink/70">{relativeTime(m.at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Room>

      {viewer.workspace.questsEnabled && <QuestRoom today={today} />}

      <Door />
    </div>
  );
}

type Overview = NonNullable<ReturnType<typeof useStableQuery<typeof api.me.overview>>["data"]>;
type Standing = NonNullable<ReturnType<typeof useStableQuery<typeof api.me.standing>>["data"]>;

/** Your giving: this week's place, the totals, the cadence, your patterns, and you against the team. */
function YourGiving({ data, standing, period, glyph }: { data: Overview; standing: Standing | null; period: Period; glyph: string }) {
  const viewer = useViewer();
  const rank = standing?.week.rank ?? null;
  const series = [
    { key: "given", label: "Given", color: "var(--color-ember)", values: data.cadence.map((d) => d.given) },
    ...(viewer.canSeeOwnReceived ? [{ key: "received", label: "Received", color: "var(--color-pond)", values: data.cadence.map((d) => d.received) }] : []),
    ...(data.period.prevGiven !== null
      ? [{ key: "prevGiven", label: "Given (previous period to date)", color: "var(--color-ember)", values: data.cadence.map((d) => d.prevGiven), dashed: true }]
      : []),
  ];
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 @lg:grid-cols-4">
        <Stat label="This week" value={!standing ? "…" : rank ? `#${rank}` : "none yet"} dim={!rank}>
          {rank && standing ? `of ${standing.week.of} givers, ` : ""}
          {data.week.given} given
          <span className="block">
            <Trend cur={data.week.given} prev={data.week.lastWeekGiven} suffix="on last week" />
          </span>
          <span className="block tabular">
            {dayLabel(data.week.start)} to {dayLabel(data.week.end)}
          </span>
        </Stat>
        <Stat label="All time" value={data.totals.given}>
          given
        </Stat>
        {data.totals.received !== null ? (
          <Stat label="Received" value={data.totals.received}>
            <Heart className="inline h-3 w-3 text-pond-deep" aria-hidden /> all time
          </Stat>
        ) : (
          <Stat label="Received" value="hidden" dim>
            <Lock className="inline h-3 w-3" aria-hidden /> Received counts are private in this workspace
          </Stat>
        )}
        <Stat label="Allowance maxed" value={data.totals.maxedDays}>
          {data.totals.maxedDays === 1 ? "day" : "days"}
        </Stat>
      </dl>

      <div>
        <h4 className="font-display text-lg font-medium">Giving cadence</h4>
        <p className="text-sm text-ink/75">
          {nf.format(data.period.given)} given {data.periodLabel.toLowerCase()}{" "}
          {data.period.prevGiven !== null && <Trend cur={data.period.given} prev={data.period.prevGiven} />}
        </p>
        <div className="mt-3">
          <Legend items={series.map((s) => ({ label: s.label, color: s.color, dashed: s.dashed }))} />
          <div className="mt-3">
            <LineChart days={data.cadence.map((d) => d.day)} series={series} height={240} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 @lg:grid-cols-2">
        <div>
          <h4 className="font-display text-lg font-medium">Recognition patterns</h4>
          <ul>
            <Pattern icon={<Users className="h-4 w-4" />} label="Teammates celebrated" value={data.patterns.teammatesCelebrated} />
            <Pattern icon={<Hash className="h-4 w-4" />} label="Channels visited" value={data.patterns.channelsVisited} />
            <Pattern
              icon={<Flame className="h-4 w-4" />}
              label="Longest giving streak"
              value={data.patterns.longestStreak ? `${data.patterns.longestStreak} days` : "none yet"}
              hint={data.patterns.currentStreak ? `${data.patterns.currentStreak} day streak running` : undefined}
            />
            <Pattern icon={<CalendarDays className="h-4 w-4" />} label="Most generous on" value={data.patterns.bestWeekday ?? "none yet"} />
            <Pattern
              icon={<Heart className="h-4 w-4" />}
              label="You celebrate most"
              value={data.patterns.topRecipient ? firstName(data.patterns.topRecipient.name) : "nobody yet"}
              hint={data.patterns.topRecipient ? `${data.patterns.topRecipient.amount} ${glyph}` : undefined}
            />
            {data.patterns.topSupporter && (
              <Pattern icon={<Sparkles className="h-4 w-4" />} label="Your biggest fan" value={firstName(data.patterns.topSupporter.name)} hint={`${data.patterns.topSupporter.amount} ${glyph}`} />
            )}
          </ul>
        </div>
        <div>
          <h4 className="font-display text-lg font-medium">You and the team</h4>
          <p className="text-sm text-ink/75">
            You gave {data.period.given}, the team's median is {standing ? Math.round(standing.teamMedian) : "on its way"}.
          </p>
          <CompareBars mine={data.period.given} team={standing?.teamMedian ?? 0} />
          <Link to={compareTeamHref(period)} className="pixel-btn pixel-btn-secondary mt-4 inline-flex h-9 items-center px-3 text-sm font-semibold">
            Compare with the team
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, dim, children }: { label: string; value: number | string; dim?: boolean; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-parchment-deep/40 p-3 pixel-chip">
      <dt className="text-xs font-semibold text-ink/75">{label}</dt>
      <dd>
        <BigNumber value={value} className={clsx("block text-3xl leading-10", dim && "text-xl text-ink/70")} />
        <span className="block text-xs text-ink/75">{children}</span>
      </dd>
    </div>
  );
}

/** Today's kudos as a row of coins with the workspace's emoji: bright while left, dim once used. */
function Allowance({ used, limit, glyph }: { used: number; limit: number; glyph: string }) {
  const left = Math.max(0, limit - used);
  return (
    <div>
      <h4 className="font-display text-lg font-medium">Kudos to give today</h4>
      <div data-allowance role="img" aria-label={`${left} of ${limit} kudos left today`} className="mt-2 flex flex-wrap gap-2">
        {Array.from({ length: limit }, (_, i) =>
          i < left ? (
            <span key={i} data-left className="pixel-chip grid h-9 w-9 place-items-center bg-lantern text-lg">
              {glyph}
            </span>
          ) : (
            <span key={i} data-used className="pixel-chip grid h-9 w-9 place-items-center bg-parchment-deep text-lg opacity-40 grayscale">
              {glyph}
            </span>
          ),
        )}
      </div>
      <p className="mt-2 text-xs text-ink/75">
        {left} left and {used} used. It fills up again at midnight.
      </p>
    </div>
  );
}

/** The way to spend Hog coins, while the Store is open and the wallet shows (the server says when). */
function StoreWay() {
  const viewer = useViewer();
  const balance = useQuery(api.store.balance, viewer.workspace.storeEnabled ? {} : "skip");
  if (balance === undefined || balance === null) return null;
  return (
    <Link to="/store" className="pixel-chip flex items-center gap-3 bg-parchment px-3.5 py-2.5 text-sm hover:bg-parchment-deep/60">
      <HogCoin size={16} />
      <span className="font-semibold text-ink">The store stall</span>
      <span className="min-w-0 flex-1 text-xs text-ink/75">
        <span className={clsx("tabular", balance < 0 && "text-ember-deep")}>{nf.format(balance)}</span> Hog coins to spend
      </span>
    </Link>
  );
}

/** Messages found by rarity: one pixel bar, a block of each rarity's colour as long as its share. */
function RarityBar({ byRarity, total }: { byRarity: Overview["discoveries"]["byRarity"]; total: number }) {
  if (byRarity.length === 0) return null;
  return (
    <div>
      <div className="pixel-meter flex h-3 gap-[2px]">
        {byRarity.map((r) => (
          <div key={r.rarity} title={`${RARITY_META[r.rarity as Rarity].label}: ${r.discovered} of ${r.total}`} style={{ width: `${(r.discovered / total) * 100}%`, background: RARITY_META[r.rarity as Rarity].color }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {byRarity.map((r) => (
          <li key={r.rarity} className="flex items-center gap-1.5 tabular text-[11px] text-ink/75">
            <span className="h-2 w-2" style={{ background: RARITY_META[r.rarity as Rarity].color }} />
            {RARITY_META[r.rarity as Rarity].label} {r.discovered} of {r.total}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** This week's quests in the cabin, compact, with the way to the signpost. */
function QuestRoom({ today }: { today: string }) {
  const board = useQuery(api.quests.mine, { today });
  if (board === undefined) return <section aria-busy className="min-h-40" />;
  if (!board.enabled) return null;
  return (
    <Room
      title="Quests this week"
      subtitle={
        board.locked
          ? `Opens at level ${board.locked.level}`
          : board.available > 0
            ? `${board.completed} of ${board.available} done, a new board on Monday`
            : "Nothing to do this week, a new board on Monday"
      }
      action={
        <Link to="/quests" className={clsx(linkCls, "text-sm")}>
          Open the quest signpost
        </Link>
      }
    >
      {board.sweep && <span className="pixel-chip mb-3 inline-block bg-hedge-deep px-2 py-0.5 text-xs font-semibold text-cream">Clean sweep</span>}
      <QuestBoardBody board={board} />
      <details className="group mt-3 text-xs text-ink/75">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold text-ink select-none [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-3.5 w-3.5 group-open:rotate-90" aria-hidden /> How quests count
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-8 leading-relaxed">
          {QUEST_RULES.map((rule, i) => (
            <li key={i}>{rule}</li>
          ))}
        </ul>
      </details>
    </Room>
  );
}

/** The cabin door: the game's switch on the wall, your workspaces, signing out, and who made what. */
function Door() {
  const { workspaces } = useViewer();
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const switchWorkspace = useMutation(api.session.switchWorkspace);
  // Signed-out screens render at whatever URL is open; signing out on purpose goes home instead.
  const leave = () => void signOut().then(() => navigate("/", { replace: true }));
  const current = workspaces.find((w) => w.current);
  return (
    // `#door`: the HUD's settings menu links here for "Hide the game".
    <Room title="The door" id="door">
      <GameSwitch />
      {workspaces.length > 1 && current && (
        <label className="block py-3">
          <span className="block text-sm font-semibold">Workspace</span>
          <span className="block text-sm text-ink/75">The world you walk in. Each workspace has its own garden.</span>
          <select
            className="mt-2 h-10 w-full max-w-xs border-2 border-bark bg-parchment px-2 text-sm text-ink"
            value={current.memberId}
            onChange={(e) => void switchWorkspace({ memberId: e.target.value as Id<"members"> })}
          >
            {workspaces.map((w) => (
              <option key={w.memberId} value={w.memberId}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="button" onClick={leave} className="pixel-btn pixel-btn-secondary mt-3 inline-flex h-10 items-center gap-2 px-4 text-sm font-semibold">
        <LogOut className="h-4 w-4" aria-hidden />
        Sign out
      </button>
      <p className="mt-6 border-t border-parchment-deep pt-3 text-xs text-ink/75">
        About: Kudos turns the thank-yous you say in Slack into a garden. Your hedgehog is {HEDGEHOG_MODE.credit}.
      </p>
    </Room>
  );
}

function Pattern({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <li className="flex items-center gap-3 border-t border-parchment-deep py-2.5 first:border-t-0">
      <span className="pixel-chip grid h-8 w-8 shrink-0 place-items-center bg-parchment-deep/60 text-ink/75" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-sm text-ink/75">{label}</span>
      <span className="text-right">
        <span className="block font-display text-base font-medium tabular">{value}</span>
        {hint && <span className="block text-[11px] text-ink/70">{hint}</span>}
      </span>
    </li>
  );
}

function CompareBars({ mine, team }: { mine: number; team: number }) {
  const max = Math.max(1, mine, team);
  return (
    <div data-compare-bars className="mt-3 space-y-2">
      {[
        { label: "You", value: mine, color: "var(--color-ember)" },
        { label: "Team", value: team, color: "var(--color-benchmark)" },
      ].map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-10 shrink-0 text-xs text-ink/75">{r.label}</span>
          <div className="pixel-meter h-3 min-w-0 flex-1">
            <div data-fill style={{ "--fill": meterFill(r.value, max), background: r.color } as React.CSSProperties} />
          </div>
        </div>
      ))}
    </div>
  );
}
