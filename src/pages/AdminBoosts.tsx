import clsx from "clsx";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { CalendarPlus, CircleAlert, Megaphone, X, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { BOOST_NAME, dayLabel } from "../../convex/lib/boosts";
import { addDays } from "../../convex/lib/time";
import { Button, Card, CardHeader, Field, inputCls, PageSkeleton } from "@/components/ui";
import { announcementStatus, startedBy } from "@/lib/boosts";
import { useWorkspaceToday } from "@/lib/period";

const message = (e: unknown) => (e instanceof ConvexError ? String(e.data) : "Something went wrong. Try again.");

/**
 * Admin → Bonus days (#97, §G9, G14): the announcement channel, scheduling bonus days in advance,
 * and every boost from today on with how its announcement went.
 */
export function AdminBoosts({ gameEnabled }: { gameEnabled: boolean }) {
  const today = useWorkspaceToday();
  const data = useQuery(api.boosts.admin, { today });
  if (!data) return <PageSkeleton />;
  return (
    <div className="grid gap-4">
      {!gameEnabled && (
        <p className="flex items-start gap-2.5 border border-bark/60 bg-parchment-deep/50 px-4 py-3 text-sm text-ink/75">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ink/70" />
          Bonus days double XP and Hog coins, which only exist while the game is on (Settings).
        </p>
      )}
      <ScheduleCard today={today} maxAheadDays={data.maxAheadDays} channel={data.isDemo ? null : data.channel} />
      <ChannelCard channel={data.channel} isDemo={data.isDemo} />
      <Card>
        <CardHeader
          title="Today and ahead"
          subtitle="One boost a day at most. Scheduled days can be called off until they start; a booster runs until midnight."
          icon={<Zap className="h-4 w-4 text-soil" />}
        />
        {data.boosts.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-ink/75">No bonus days or boosters yet.</p>
        ) : (
          <ul className="divide-y divide-parchment-deep">
            {data.boosts.map((b) => (
              <BoostRow key={b._id} boost={b} today={today} isDemo={data.isDemo} hasChannel={data.channel !== null} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

type AdminBoost = NonNullable<ReturnType<typeof useQuery<typeof api.boosts.admin>>>["boosts"][number];

function BoostRow({ boost, today, isDemo, hasChannel }: { boost: AdminBoost; today: string; isDemo: boolean; hasChannel: boolean }) {
  const cancel = useMutation(api.boosts.cancel);
  const repost = useMutation(api.boosts.repost);
  const [error, setError] = useState<string | null>(null);
  const status = announcementStatus(boost.announcement, isDemo);
  const cancellable = boost.source === "schedule" && boost.dayKey > today;
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium text-ink">
            {boost.dayKey === today ? "Today" : dayLabel(boost.dayKey)}: {BOOST_NAME[boost.kind]}
          </div>
          <div className="text-xs text-ink/70">{startedBy(boost.source, boost.by)}</div>
        </div>
        {cancellable && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setError(null);
              cancel({ boostId: boost._id as Id<"boosts"> }).catch((e) => setError(message(e)));
            }}
          >
            <X className="h-4 w-4" /> Call off
          </Button>
        )}
      </div>
      <blockquote className="mt-3 border border-parchment-deep bg-parchment-deep/40 px-4 py-3 text-sm leading-relaxed text-ink">
        <span className="mb-1 flex items-center gap-1.5 tabular text-[10px] text-ink/70">
          <Megaphone className="h-3 w-3" aria-hidden /> Announcement
        </span>
        {boost.text}
      </blockquote>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <p className={clsx("text-xs", status.tone === "ok" ? "text-pond-deep" : status.tone === "error" ? "text-ember-deep" : "text-ink/75")}>{status.text}</p>
        {!isDemo && hasChannel && boost.dayKey >= today && (boost.announcement?.status === "failed" || boost.announcement?.status === "skipped") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null);
              repost({ boostId: boost._id as Id<"boosts"> }).catch((e) => setError(message(e)));
            }}
          >
            <Megaphone className="h-4 w-4" /> Post it now
          </Button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-ember-deep">{error}</p>}
    </li>
  );
}

function ScheduleCard({ today, maxAheadDays, channel }: { today: string; maxAheadDays: number; channel: Channel | null }) {
  const schedule = useMutation(api.boosts.schedule);
  const tomorrow = addDays(today, 1);
  const [day, setDay] = useState(tomorrow);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "done" } | { kind: "error"; message: string }>({ kind: "idle" });
  useEffect(() => setDay((d) => (d < tomorrow ? tomorrow : d)), [tomorrow]);
  const submit = async () => {
    setState({ kind: "saving" });
    try {
      await schedule({ day });
      setState({ kind: "done" });
    } catch (e) {
      setState({ kind: "error", message: message(e) });
    }
  };
  return (
    <Card>
      <CardHeader
        title="Schedule a bonus day"
        subtitle="All day, every thoughtful kudos earns double XP and Hog coins. Kudos amounts, allowances and the daily XP cap stay as they are."
        icon={<CalendarPlus className="h-4 w-4 text-soil" />}
      />
      <div className="flex flex-wrap items-end gap-3 px-5 pb-5">
        <Field label="Day" hint="Announced as soon as you schedule it." className="min-w-[200px] flex-1">
          <input type="date" className={inputCls} value={day} min={tomorrow} max={addDays(today, maxAheadDays)} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <Button variant="primary" onClick={() => void submit()} disabled={state.kind === "saving" || !day}>
          {state.kind === "saving" ? "Scheduling…" : "Schedule bonus day"}
        </Button>
        {state.kind === "error" && <p className="w-full text-sm text-ember-deep">{state.message}</p>}
        {state.kind === "done" && (
          <p className="w-full text-sm text-pond-deep">{channel ? `Scheduled, and announced in #${channel.name}.` : "Scheduled. It's announced on the banner in the app."}</p>
        )}
      </div>
    </Card>
  );
}

type Channel = { id: string; name: string };

function ChannelCard({ channel, isDemo }: { channel: Channel | null; isDemo: boolean }) {
  const setChannel = useMutation(api.boosts.setChannel);
  const listChannels = useAction(api.boosts.channels);
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (isDemo) return;
    listChannels({})
      .then(setChannels)
      .catch((e) => setError(message(e)));
  }, [isDemo, listChannels]);
  const current = channels?.find((c) => c.id === channel?.id);
  return (
    <Card>
      <CardHeader
        title="Announcement channel"
        subtitle="Bonus days and company-wide boosters are posted here, and always shown on a banner in the app."
        icon={<Megaphone className="h-4 w-4 text-soil" />}
      />
      <div className="space-y-3 px-5 pb-5 text-sm">
        {isDemo ? (
          <p className="text-ink/75">
            The demo has no Slack. In a real workspace boosts are posted in the channel you pick; here each one shows its post for{" "}
            <span className="font-medium text-ink">#{channel?.name ?? "general"}</span> as a preview.
          </p>
        ) : channels === null && !error ? (
          <p className="text-ink/75">Loading channels…</p>
        ) : (
          <Field label="Channel" hint="The Kudos app can only post in channels it's in. Missing one? Invite it there with /invite @Kudos, then reload.">
            <select
              className={inputCls}
              value={channel?.id ?? ""}
              onChange={(e) => {
                const picked = channels?.find((c) => c.id === e.target.value);
                setError(null);
                setChannel({ channel: picked ? { id: picked.id, name: picked.name } : null }).catch((err) => setError(message(err)));
              }}
            >
              <option value="">No channel: the banner only</option>
              {channel && !current && <option value={channel.id}>#{channel.name} (the Kudos app isn't in it)</option>}
              {(channels ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {channels !== null && channel && !current && (
          <p className="text-ember-deep">The Kudos app isn't in #{channel.name}, so it can't post there. Invite it with /invite @Kudos in that channel.</p>
        )}
        {error && <p className="text-ember-deep">{error}</p>}
      </div>
    </Card>
  );
}
