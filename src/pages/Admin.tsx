import clsx from "clsx";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Check, CircleAlert, RefreshCw, RotateCcw, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Avatar, Button, Card, CardHeader, Eyebrow, PageHeader, PageSkeleton, Segmented, Toggle } from "@/components/ui";
import { nf, relativeTime } from "@/lib/format";
import { useViewer } from "@/lib/viewer";
import { CopyButton } from "./Setup";
import { SlackMark } from "./Landing";

type Tab = "settings" | "members" | "moderation" | "slack";

export function Admin() {
  const [tab, setTab] = useState<Tab>("settings");
  const data = useQuery(api.admin.overview);
  if (!data) return <PageSkeleton />;
  return (
    <div>
      <PageHeader
        eyebrow={data.workspace.name}
        title="Admin"
        subtitle="Tune how kudos work in your workspace, manage admins and keep things fair."
        action={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "settings", label: "Settings" },
              { value: "members", label: "Members" },
              { value: "moderation", label: "Moderation" },
              { value: "slack", label: "Slack" },
            ]}
          />
        }
      />
      {tab === "settings" && <SettingsForm initial={data.settings} isDemo={data.workspace.isDemo} />}
      {tab === "members" && <Members />}
      {tab === "moderation" && <Moderation />}
      {tab === "slack" && <SlackPanel slack={data.slack} isDemo={data.workspace.isDemo} teamId={data.workspace.slackTeamId} />}
    </div>
  );
}

type Settings = NonNullable<ReturnType<typeof useQuery<typeof api.admin.overview>>>["settings"];

const TIMEZONES = ["Europe/Berlin", "Europe/London", "Europe/Lisbon", "Europe/Madrid", "Europe/Stockholm", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Tokyo", "Asia/Kolkata", "Australia/Sydney", "UTC"];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

const inputCls = "h-10 w-full rounded-xl border border-line-strong bg-ink/60 px-3 text-sm text-cream outline-none transition focus:border-saffron/60";

function SettingsForm({ initial, isDemo }: { initial: Settings; isDemo: boolean }) {
  const [s, setS] = useState(initial);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string }>({ kind: "idle" });
  const update = useMutation(api.admin.updateSettings);
  const resetDemo = useMutation(api.demo.resetDemo);
  useEffect(() => setS(initial), [initial]);
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    setState({ kind: "saving" });
    try {
      await update(s);
      setState({ kind: "saved" });
      setTimeout(() => setState({ kind: "idle" }), 1800);
    } catch (e) {
      setState({ kind: "error", message: e instanceof ConvexError ? String(e.data) : "Couldn't save settings." });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {isDemo && (
        <div className="rounded-xl border border-line-strong bg-panel-2/60 px-4 py-3 text-sm text-muted xl:col-span-2">
          Everyone exploring the demo shares this admin account, so settings are read-only here. In your own workspace every option below is live.
        </div>
      )}
      <Card>
        <CardHeader title="Giving" subtitle="What people type in Slack and how much they can give." />
        <div className="grid grid-cols-1 gap-5 px-5 pb-5 sm:grid-cols-2">
          <Field label="Slack emoji" hint="Shortcode without colons, custom emoji work too">
            <div className="flex items-center gap-2">
              <span className="font-mono text-muted">:</span>
              <input className={inputCls} value={s.emojiName} onChange={(e) => set("emojiName", e.target.value)} />
              <span className="font-mono text-muted">:</span>
            </div>
          </Field>
          <Field label="Web emoji" hint="Shown in the dashboard">
            <input className={clsx(inputCls, "text-lg")} value={s.emojiGlyph} onChange={(e) => set("emojiGlyph", e.target.value)} />
          </Field>
          <Field label="Daily allowance" hint="Kudos each person can give per day">
            <div className="flex items-center gap-3">
              <input type="range" min={1} max={20} value={s.dailyLimit} onChange={(e) => set("dailyLimit", Number(e.target.value))} className="flex-1 accent-[var(--color-saffron)]" />
              <span className="w-10 text-right font-display text-xl font-semibold tabular">{s.dailyLimit}</span>
            </div>
          </Field>
          <Field label="Timezone" hint="When the daily allowance resets">
            <select className={inputCls} value={s.timezone} onChange={(e) => set("timezone", e.target.value)}>
              {[...new Set([s.timezone, ...TIMEZONES])].map((tz) => (
                <option key={tz}>{tz}</option>
              ))}
            </select>
          </Field>
          <Field label="Unit (singular)">
            <input className={inputCls} value={s.unitSingular} onChange={(e) => set("unitSingular", e.target.value)} />
          </Field>
          <Field label="Unit (plural)">
            <input className={inputCls} value={s.unitPlural} onChange={(e) => set("unitPlural", e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Privacy & notifications" />
        <div className="px-5 pb-5">
          <Eyebrow className="mb-2">Received kudos visibility</Eyebrow>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(
              [
                { v: "hidden", title: "Hidden", body: "Nobody sees received counts. Pure giving culture." },
                { v: "self", title: "Only me", body: "People see their own received kudos." },
                { v: "everyone", title: "Everyone", body: "Received counts on leaderboards and analytics." },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                onClick={() => set("receivedVisibility", o.v)}
                className={clsx("rounded-xl border p-3 text-left transition", s.receivedVisibility === o.v ? "border-saffron/60 bg-saffron/10" : "border-line bg-ink/40 hover:border-line-strong")}
              >
                <div className="flex items-center justify-between text-sm font-medium">
                  {o.title}
                  {s.receivedVisibility === o.v && <Check className="h-4 w-4 text-saffron" />}
                </div>
                <p className="mt-1 text-xs text-muted">{o.body}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 divide-y divide-line">
            <Toggle checked={s.reactionsEnabled} onChange={(v) => set("reactionsEnabled", v)} label="Reactions give kudos" description={`Reacting with :${s.emojiName}: gives the message author one kudos.`} />
            <Toggle checked={s.notifyGiver} onChange={(v) => set("notifyGiver", v)} label="DM givers" description="Confirm each kudos with a rarity-rolled message." />
            <Toggle checked={s.notifyReceiver} onChange={(v) => set("notifyReceiver", v)} label="DM receivers" description="Let people know when they've been recognized." />
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3 xl:col-span-2">
        <Button variant="primary" onClick={save} disabled={isDemo || !dirty || state.kind === "saving"}>
          {state.kind === "saving" ? "Saving…" : state.kind === "saved" ? <><Check className="h-4 w-4" /> Saved</> : "Save settings"}
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setS(initial)}>
            Discard
          </Button>
        )}
        {state.kind === "error" && (
          <span className="flex items-center gap-1.5 text-sm text-down">
            <CircleAlert className="h-4 w-4" /> {state.message}
          </span>
        )}
        {isDemo && (
          <Button variant="outline" className="ml-auto" onClick={() => void resetDemo()}>
            <RotateCcw className="h-4 w-4" /> Reset demo data
          </Button>
        )}
      </div>
    </div>
  );
}

function Members() {
  const viewer = useViewer();
  const members = useQuery(api.admin.members);
  const setAdmin = useMutation(api.admin.setAdmin);
  const [q, setQ] = useState("");
  if (!members) return <PageSkeleton />;
  const shown = members.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card>
      <CardHeader
        title={`${members.length} members`}
        subtitle={`${members.filter((m) => m.isAdmin).length} admins · ${members.filter((m) => m.signedIn).length} have opened the dashboard`}
        action={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input className={clsx(inputCls, "w-56 pl-9")} placeholder="Search members" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
      />
      <div className="overflow-x-auto px-2 pb-3">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
              <th className="px-3 py-2 font-normal">Member</th>
              <th className="px-3 py-2 text-right font-normal">Given</th>
              <th className="px-3 py-2 text-right font-normal">Received</th>
              <th className="px-3 py-2 text-right font-normal">Maxed days</th>
              <th className="px-3 py-2 text-right font-normal">Last gave</th>
              <th className="px-3 py-2 text-right font-normal">Admin</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m._id} className={clsx("border-t border-line", m.deactivated && "opacity-50")}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} src={m.avatarUrl} size={30} />
                    <div>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-faint">{m.deactivated ? "Deactivated" : m.title ?? m.slackUserId}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular">{nf.format(m.totalGiven)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular" title={m.totalReceived === null ? "Hidden by the received-kudos visibility setting" : undefined}>
                  {m.totalReceived === null ? <span className="text-faint">—</span> : nf.format(m.totalReceived)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular">{m.totalMaxedDays}</td>
                <td className="px-3 py-2.5 text-right text-muted">{m.lastGivenAt ? relativeTime(m.lastGivenAt) : "never"}</td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    role="switch"
                    aria-checked={m.isAdmin}
                    aria-label={`Admin: ${m.name}`}
                    disabled={viewer.workspace.isDemo}
                    title={viewer.workspace.isDemo ? "Read-only in the shared demo" : undefined}
                    onClick={() => void setAdmin({ memberId: m._id, isAdmin: !m.isAdmin }).catch(() => {})}
                    className={clsx("relative inline-block h-5 w-9 rounded-full transition-colors disabled:opacity-50", m.isAdmin ? "bg-saffron" : "bg-panel-3")}
                  >
                    <span className={clsx("absolute top-0.5 h-4 w-4 rounded-full bg-cream transition-all", m.isAdmin ? "left-[18px]" : "left-0.5")} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Moderation() {
  const viewer = useViewer();
  const { results, status, loadMore } = usePaginatedQuery(api.admin.recentKudos, {}, { initialNumItems: 25 });
  const revoke = useMutation(api.admin.revoke);
  const [confirm, setConfirm] = useState<Id<"kudos"> | null>(null);
  return (
    <Card>
      <CardHeader title="Recent kudos" subtitle="Revoke kudos given by mistake. Totals, allowances and leaderboards update instantly." />
      <ul className="px-2 pb-3">
        {results.map((k) => (
          <li key={k._id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-panel-2/50">
            <Avatar name={k.giver?.name ?? "?"} src={k.giver?.avatarUrl} size={30} />
            <div className="min-w-0 flex-1">
              <div className="text-sm">
                <b className="font-medium">{k.giver?.name}</b> <span className="text-muted">→</span> <b className="font-medium">{k.receiver?.name}</b>{" "}
                <span className="font-mono text-xs text-saffron">
                  {k.amount} {viewer.workspace.emojiGlyph}
                </span>
                {k.channel && <span className="ml-2 font-mono text-xs text-faint">#{k.channel}</span>}
              </div>
              <p className="truncate text-xs text-muted">{k.text}</p>
            </div>
            <span className="hidden text-xs text-faint sm:block">{relativeTime(k.at)}</span>
            {confirm === k._id ? (
              <Button size="sm" variant="danger" onClick={() => void revoke({ kudosId: k._id }).then(() => setConfirm(null))}>
                Confirm
              </Button>
            ) : (
              <button onClick={() => setConfirm(k._id)} className="rounded-lg p-2 text-faint hover:bg-down/10 hover:text-down" aria-label="Revoke kudos">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {status === "CanLoadMore" && (
        <div className="px-5 pb-5">
          <Button variant="outline" onClick={() => loadMore(25)}>
            Load more
          </Button>
        </div>
      )}
    </Card>
  );
}

type SlackInfo = NonNullable<ReturnType<typeof useQuery<typeof api.admin.overview>>>["slack"];

function SlackPanel({ slack, isDemo, teamId }: { slack: SlackInfo; isDemo: boolean; teamId: string }) {
  const resync = useMutation(api.admin.resyncMembers);
  const [synced, setSynced] = useState(false);
  const rows = [
    { label: "Events API request URL", value: slack.endpoints.events },
    { label: "Slash command URL (/kudos)", value: slack.endpoints.commands },
    { label: "Interactivity URL", value: slack.endpoints.interactions },
    { label: "Install link (OAuth)", value: slack.endpoints.install },
    { label: "App manifest", value: slack.endpoints.manifest },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.4fr]">
      <Card className="p-5">
        <Eyebrow>Connection</Eyebrow>
        <div className="mt-3 flex items-center gap-3">
          <span className={clsx("h-2.5 w-2.5 rounded-full", slack.connected ? "bg-up shadow-[0_0_12px_var(--color-up)]" : "bg-faint")} />
          <span className="font-display text-xl font-semibold">{isDemo ? "Demo workspace" : slack.connected ? "Connected to Slack" : "Not connected"}</span>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Team ID</dt><dd className="font-mono">{teamId}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Bot user</dt><dd className="font-mono">{slack.botUserId ?? "–"}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Signing secret</dt><dd>{slack.signingSecretConfigured ? "configured" : "missing"}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">OAuth credentials</dt><dd>{slack.oauthConfigured ? "configured" : "missing"}</dd></div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={slack.endpoints.install}>
            <Button variant="primary" size="sm">
              <SlackMark /> {slack.connected ? "Reinstall" : "Add to Slack"}
            </Button>
          </a>
          {!isDemo && (
            <Button size="sm" onClick={() => void resync().then(() => setSynced(true))}>
              <RefreshCw className="h-3.5 w-3.5" /> {synced ? "Sync started" : "Resync members"}
            </Button>
          )}
        </div>
      </Card>
      <Card>
        <CardHeader title="Endpoints" subtitle="Slack talks to Kudos over plain HTTPS webhooks (no Socket Mode)." />
        <ul className="space-y-2 px-5 pb-5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3 rounded-xl border border-line bg-ink/40 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted">{r.label}</div>
                <div className="truncate font-mono text-xs">{r.value}</div>
              </div>
              <CopyButton text={r.value} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
