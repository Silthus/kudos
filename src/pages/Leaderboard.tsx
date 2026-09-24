import clsx from "clsx";
import { motion } from "motion/react";
import { ArrowDown, ArrowUp, Lock, Sparkles, TrendingUp, Trophy, Users, Zap } from "lucide-react";
import { useSearchParams } from "react-router";
import type { ReactNode } from "react";
import { PrototypeSwitcher } from "@/components/PrototypeSwitcher";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { Ring } from "@/components/charts";
import { Avatar, BigNumber, Card, CardHeader, Empty, Eyebrow, PageHeader, PageSkeleton, RarityPip, Segmented, Trend, Window } from "@/components/ui";
import { nf, pct, rangeLabel } from "@/lib/format";
import { DEFAULT_PERIOD, PERIOD_OPTIONS, useWorkspaceToday, type Period } from "@/lib/period";
import { useStableQuery } from "@/lib/useStableQuery";
import { useViewer } from "@/lib/viewer";

// PROTOTYPE (#54): two structurally different PostHog takes on the leaderboard, switchable with ?variant=A|B.
// A = "Lemon product" (PostHog app idiom: scene header, LemonTable, insight tiles). B = "OS desktop" (posthog.com
// idiom: the same content in draggable windows on a desktop). Data fetching is shared; only rendering differs.
const PODIUM = [
  { label: "1st", h: 92, tint: "var(--k-cta-face)" },
  { label: "2nd", h: 64, tint: "var(--k-surface-3)" },
  { label: "3rd", h: 44, tint: "color-mix(in oklab, var(--k-cta-shell) 35%, var(--k-surface-3))" },
];

type Data = NonNullable<ReturnType<typeof useLeaderboardData>["data"]>;

function useLeaderboardData(period: Period, metric: "given" | "received") {
  const today = useWorkspaceToday();
  return useStableQuery(api.leaderboard.get, { period, metric, today });
}

export function Leaderboard() {
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [metric, setMetric] = useState<"given" | "received">("given");
  const [params] = useSearchParams();
  const variant = params.get("variant") === "B" ? "B" : "A";
  const { data, isStale } = useLeaderboardData(period, metric);
  if (!data) return <PageSkeleton />;
  const controls = (
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
      <Segmented value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
    </>
  );
  return (
    <div className={`transition-opacity duration-200 ${isStale ? "opacity-60" : ""}`} aria-busy={isStale}>
      {variant === "A" ? <VariantA data={data} controls={controls} /> : <VariantB data={data} controls={controls} />}
      <PrototypeSwitcher variants={["A", "B"]} names={{ A: "Lemon product", B: "OS desktop" }} current={variant} />
    </div>
  );
}

function Podium({ data }: { data: Data }) {
  const glyph = data.unit.glyph;
  const podium = data.rows.slice(0, 3);
  return (
    <div className="grid grid-cols-3 items-end gap-3 px-4 pt-6 sm:gap-5 sm:px-8">
      {[1, 0, 2].map((idx) => {
        const r = podium[idx];
        if (!r) return <div key={idx} />;
        const p = PODIUM[idx];
        return (
          <motion.div
            key={r.member._id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + idx * 0.08, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            className="flex min-w-0 flex-col items-center text-center"
          >
            <Avatar name={r.member.name} src={r.member.avatarUrl} size={idx === 0 ? 64 : 52} ring="ring-2 ring-border-bold ring-offset-2 ring-offset-surface" />
            <div className="mt-2 max-w-full truncate text-[15px] font-bold">{r.member.name}</div>
            <div className="max-w-full truncate text-xs text-text-3">{r.member.title}</div>
            <div className="mt-1 font-display text-2xl font-extrabold tabular">
              {nf.format(r.value)} <span className="text-base">{glyph}</span>
            </div>
            {/* The podium steps are Lemon 3D blocks: a face on a darker frame. */}
            <div
              data-hog-platform
              className="mt-2 flex w-full items-start justify-center rounded-t-[var(--radius-lemon)] border border-b-0 border-border-bold pt-2 text-xs font-bold"
              style={{ height: p.h, background: p.tint, boxShadow: "inset 0 -3px 0 color-mix(in oklab, black 12%, transparent)", color: idx === 0 ? "#111" : undefined }}
            >
              {p.label}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Standings({ data, flush }: { data: Data; flush?: boolean }) {
  const glyph = data.unit.glyph;
  const max = Math.max(1, ...data.rows.map((r) => r.value));
  if (data.rows.length === 0) return <Empty icon={<Trophy className="h-6 w-6 text-text-3" />} title="No kudos in this period yet">The first person to share some appreciation takes the top spot.</Empty>;
  return (
    <div className={clsx("overflow-x-auto", !flush && "rounded-[var(--radius-lemon)] border border-border")}>
      <table className="w-full min-w-[620px] text-[13px]">
        <thead>
          <tr className="bg-surface-2 text-left text-xs font-semibold text-text-2">
            <th className="w-12 border-b border-border px-3 py-2">Rank</th>
            <th className="border-b border-border px-3 py-2">Teammate</th>
            <th className="w-56 border-b border-border px-3 py-2">Kudos {data.metric}</th>
            <th className="border-b border-border px-3 py-2 text-right">Change</th>
            <th className="border-b border-border px-3 py-2 text-right" title="Days the daily allowance was fully used">Maxed days</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.member._id} className={clsx("border-b border-border last:border-b-0 hover:bg-surface-2", r.isMe && "bg-[color-mix(in_oklab,var(--k-accent)_7%,var(--k-surface))] shadow-[inset_3px_0_0_var(--k-accent)]")}>
              <td className="px-3 py-2">
                <RankChip rank={r.rank} />
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <Avatar name={r.member.name} src={r.member.avatarUrl} size={28} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {r.member.name}
                      {r.isMe && <span className="ml-2 rounded border border-accent/40 bg-accent/10 px-1 py-px text-[10px] font-bold text-link">You</span>}
                    </div>
                    {r.member.title && <div className="truncate text-xs text-text-3">{r.member.title}</div>}
                  </div>
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 text-right font-bold tabular">{nf.format(r.value)}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-series-given" style={{ width: `${(r.value / max) * 100}%` }} />
                  </div>
                  <span className="sr-only">{glyph}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-right">
                <Change delta={r.delta} rankChange={r.rankChange} isNew={r.isNew} />
              </td>
              <td className="px-3 py-2 text-right tabular text-text-2">{r.maxedDays}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankChip({ rank }: { rank: number }) {
  if (rank > 3) return <span className="pl-2 text-xs font-semibold tabular text-text-3">{rank}</span>;
  return (
    <span
      className="grid h-6 w-6 place-items-center rounded-[var(--radius-lemon)] border text-xs font-bold tabular"
      style={{ background: rank === 1 ? "var(--k-cta-face)" : "var(--k-surface-2)", borderColor: rank === 1 ? "var(--k-cta-border)" : "var(--k-border-bold)", boxShadow: `0 2px 0 ${rank === 1 ? "var(--k-cta-shell)" : "var(--k-border-bold)"}`, color: rank === 1 ? "#111" : undefined }}
    >
      {rank}
    </span>
  );
}

function Tiles({ data }: { data: Data }) {
  const viewer = useViewer();
  const glyph = data.unit.glyph;
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <Eyebrow>Kudos shared</Eyebrow>
        <div className="mt-1 flex items-baseline gap-2">
          <BigNumber value={data.highlights.total} className="text-[44px] leading-none" />
          <span className="text-xl">{glyph}</span>
        </div>
        <div className="mt-2">
          <Trend cur={data.highlights.total} prev={data.highlights.prevTotal} suffix="vs last period to date" />
        </div>
      </Card>
      <Card className="flex items-center gap-4 p-4">
        <Ring value={data.highlights.participation} color="var(--k-series-received)" size={72} stroke={7}>
          <span className="text-sm font-bold tabular">{pct(data.highlights.participation)}</span>
        </Ring>
        <div>
          <Eyebrow>Participation</Eyebrow>
          <p className="mt-1 text-[13px] text-text-2">
            <b className="text-text">{data.highlights.givers}</b> of {data.highlights.teamSize} teammates gave kudos
          </p>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <MiniStat icon={<TrendingUp className="h-3.5 w-3.5" />} label="Rising" value={data.highlights.rising} hint="gave more than last period" />
        <MiniStat icon={<Zap className="h-3.5 w-3.5" />} label="Maxed days" value={data.highlights.maxedDays} hint="full allowance used" />
        <MiniStat icon={<Sparkles className="h-3.5 w-3.5" />} label="Discoveries" value={data.highlights.discoveries} hint="messages found" />
        <MiniStat icon={<RarityPip rarity="legendary" />} label="Legendary" value={data.highlights.legendaryFinds} hint="legendary finds" />
      </div>
      {data.myRow && (
        <Card className="p-4">
          <Eyebrow>Your position</Eyebrow>
          <div className="mt-2 flex items-center gap-3">
            <Avatar name={viewer.member.name} src={viewer.member.avatarUrl} size={36} />
            <div>
              <div className="font-display text-2xl font-extrabold">#{data.myRow.rank}</div>
              <div className="text-xs text-text-2">
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
  );
}

function VariantA({ data, controls }: { data: Data; controls: ReactNode }) {
  return (
    <>
      <PageHeader
        eyebrow={data.range ? rangeLabel(data.range.start, data.range.end) : "Since the beginning"}
        title="Leaderboard"
        subtitle={data.metric === "given" ? "Ranked by generosity: who's been handing out the most kudos." : "Ranked by kudos received."}
        action={controls}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {data.rows.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader title="Top givers" />
              <Podium data={data} />
            </Card>
          )}
          <Card className="overflow-hidden">
            <CardHeader title="Standings" subtitle={data.previousRange ? `Change compared with ${rangeLabel(data.previousRange.start, data.previousRange.end)}` : undefined} />
            <div className="px-4 pb-4">
              <Standings data={data} />
            </div>
          </Card>
        </div>
        <Tiles data={data} />
      </div>
    </>
  );
}

function DraggableWindow({ title, children, className, icon }: { title: string; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <motion.div drag dragMomentum={false} className={clsx("cursor-grab active:cursor-grabbing", className)}>
      <Window title={title} icon={icon}>
        {children}
      </Window>
    </motion.div>
  );
}

function VariantB({ data, controls }: { data: Data; controls: ReactNode }) {
  const glyph = data.unit.glyph;
  return (
    <div
      className="-mx-4 -mt-5 min-h-[calc(100dvh-40px)] px-6 py-6 sm:-mx-6"
      style={{ backgroundImage: "radial-gradient(color-mix(in oklab, var(--k-text) 14%, transparent) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="mr-auto flex items-center gap-2 rounded-[var(--radius-lemon)] border border-border-bold bg-surface px-3 py-1.5" style={{ boxShadow: "var(--k-shadow-elevation)" }}>
          <Trophy className="h-4 w-4 text-accent" />
          <span className="font-display text-lg font-extrabold">Leaderboard</span>
          <span className="text-xs text-text-3">{data.range ? rangeLabel(data.range.start, data.range.end) : "Since the beginning"}</span>
        </div>
        {controls}
      </div>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <DraggableWindow title="podium.app" icon={<Trophy className="h-3.5 w-3.5 text-text-3" />}>
            <Podium data={data} />
          </DraggableWindow>
          <DraggableWindow title={`standings — ${data.rows.length} teammates`} icon={<Users className="h-3.5 w-3.5 text-text-3" />}>
            <Standings data={data} flush />
          </DraggableWindow>
        </div>
        <div className="space-y-5">
          <DraggableWindow title="kudos-shared.txt">
            <div className="p-4">
              <BigNumber value={data.highlights.total} className="text-5xl" /> <span className="text-2xl">{glyph}</span>
              <div className="mt-1">
                <Trend cur={data.highlights.total} prev={data.highlights.prevTotal} suffix="vs last period to date" />
              </div>
            </div>
          </DraggableWindow>
          <DraggableWindow title="participation.chart">
            <div className="flex items-center gap-4 p-4">
              <Ring value={data.highlights.participation} color="var(--k-series-received)" size={72} stroke={7}>
                <span className="text-sm font-bold tabular">{pct(data.highlights.participation)}</span>
              </Ring>
              <p className="text-[13px] text-text-2">
                <b className="text-text">{data.highlights.givers}</b> of {data.highlights.teamSize} gave kudos
              </p>
            </div>
          </DraggableWindow>
        </div>
      </div>
    </div>
  );
}

function Change({ delta, rankChange, isNew }: { delta: number | null; rankChange: number | null; isNew: boolean }) {
  if (delta === null) return <span className="text-faint">–</span>;
  if (isNew) return <span className="rounded border border-border-bold bg-surface-2 px-1.5 py-px text-[11px] font-semibold text-text-2">New</span>;
  return (
    <span className="inline-flex items-center gap-2">
      {rankChange !== null && rankChange !== 0 && (
        <span className={clsx("inline-flex items-center text-[11px] font-semibold", rankChange > 0 ? "text-up" : "text-down")} title={`${Math.abs(rankChange)} place${Math.abs(rankChange) === 1 ? "" : "s"} ${rankChange > 0 ? "up" : "down"}`}>
          {rankChange > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {Math.abs(rankChange)}
        </span>
      )}
      <span className={clsx("text-xs font-semibold tabular", delta > 0 ? "text-up" : delta < 0 ? "text-down" : "text-faint")}>
        {delta > 0 ? `+${delta}` : delta === 0 ? "±0" : delta}
      </span>
    </span>
  );
}

function MiniStat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-text-2">
        <span className="text-text-3">{icon}</span>
        {label}
      </div>
      <BigNumber value={value} className="mt-1 block text-[28px] leading-tight" />
      <div className="text-[11px] text-text-3">{hint}</div>
    </Card>
  );
}
