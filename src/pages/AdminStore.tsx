import clsx from "clsx";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { AnimatePresence, motion } from "motion/react";
import { Archive, ChevronDown, CircleAlert, MessageCircleQuestion, Pencil, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { BigNumber, Button, Card, CardHeader, Dialog, Empty, Eyebrow, Field, inputCls, Segmented, Skeleton, Toggle } from "@/components/ui";
import { nf } from "@/lib/format";
import { useViewer } from "@/lib/viewer";
import { RewardCard } from "./Store";

type Section = "requests" | "catalog" | "settings";
type Reward = NonNullable<ReturnType<typeof useQuery<typeof api.storeAdmin.rewards>>>[number];

const errorText = (e: unknown, fallback: string) => (e instanceof ConvexError ? String(e.data) : fallback);

function DemoNotice({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 rounded-xl border border-line-strong bg-panel-2/60 px-4 py-3 text-sm text-muted">{children}</div>;
}

export function AdminStore({ isDemo }: { isDemo: boolean }) {
  // Requests is a placeholder until redeeming ships, so the catalog is where admins start.
  const [section, setSection] = useState<Section>("catalog");
  return (
    <div>
      <div className="mb-4">
        <Segmented
          size="sm"
          value={section}
          onChange={setSection}
          options={[
            { value: "requests", label: "Requests" },
            { value: "catalog", label: "Catalog" },
            { value: "settings", label: "Settings" },
          ]}
        />
      </div>
      {section === "requests" && <Requests />}
      {section === "catalog" && <Catalog isDemo={isDemo} />}
      {section === "settings" && <StoreSettings isDemo={isDemo} />}
    </div>
  );
}

function Requests() {
  return (
    <Card>
      <Empty icon="🛎️" title="Requests will land here">
        Redeeming arrives in the next release. Every request will queue here for an admin to approve, fulfil or decline.
      </Empty>
    </Card>
  );
}

function Catalog({ isDemo }: { isDemo: boolean }) {
  const viewer = useViewer();
  const rewards = useQuery(api.storeAdmin.rewards);
  const setStatus = useMutation(api.storeAdmin.setRewardStatus);
  const [editing, setEditing] = useState<Reward | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!rewards) return <Skeleton className="h-80" />;
  const active = rewards.filter((r) => r.status === "active");
  const archived = rewards.filter((r) => r.status === "archived");
  const glyph = viewer.workspace.emojiGlyph;

  const toggleStatus = (r: Reward) => {
    setError(null);
    setStatus({ rewardId: r._id, status: r.status === "active" ? "archived" : "active" }).catch((e) => setError(errorText(e, "Couldn't update the reward.")));
  };

  return (
    <>
      {isDemo && <DemoNotice>Everyone exploring the demo shares this admin account, so the catalog is read-only here. In your own workspace you can add and edit rewards.</DemoNotice>}
      <Card>
        <CardHeader
          title="Catalog"
          subtitle={`${active.length} active ${active.length === 1 ? "reward" : "rewards"}, cheapest first. Archived rewards stay linked to past requests.`}
          action={
            <Button variant="primary" size="sm" onClick={() => setEditing("new")} disabled={isDemo}>
              <Plus className="h-4 w-4" /> New reward
            </Button>
          }
        />
        {error && (
          <p className="mx-5 mb-2 flex items-center gap-1.5 text-sm text-down">
            <CircleAlert className="h-4 w-4" /> {error}
          </p>
        )}
        {active.length === 0 ? (
          <Empty icon="🛍️" title="No rewards yet">
            Stock the shelves before you open the store: coffee, a charity donation, a half day off.
          </Empty>
        ) : (
          <ul className="px-2 pb-3">
            {active.map((r) => (
              <RewardRow key={r._id} reward={r} glyph={glyph} isDemo={isDemo} onEdit={() => setEditing(r)} onToggle={() => toggleStatus(r)} />
            ))}
          </ul>
        )}
        {archived.length > 0 && (
          <div className="border-t border-line px-2 pb-3 pt-2">
            <button onClick={() => setShowArchived((s) => !s)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:text-cream" aria-expanded={showArchived}>
              <ChevronDown className={clsx("h-4 w-4 transition-transform", showArchived && "rotate-180")} />
              {archived.length} archived
            </button>
            <AnimatePresence initial={false}>
              {showArchived && (
                <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  {archived.map((r) => (
                    <RewardRow key={r._id} reward={r} glyph={glyph} isDemo={isDemo} onEdit={() => setEditing(r)} onToggle={() => toggleStatus(r)} />
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}
      </Card>
      <RewardEditor key={editing === "new" ? "new" : editing?._id ?? "closed"} reward={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function RewardRow({ reward: r, glyph, isDemo, onEdit, onToggle }: { reward: Reward; glyph: string; isDemo: boolean; onEdit: () => void; onToggle: () => void }) {
  const archived = r.status === "archived";
  const meta = [
    r.stock === undefined ? "Unlimited" : r.stock === 0 ? "Sold out" : `${nf.format(r.stock)} in stock`,
    r.maxPerMember !== undefined ? `${r.maxPerMember} per person` : null,
  ].filter(Boolean);
  return (
    <li className={clsx("flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-panel-2/50", archived && "opacity-60")}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-saffron/10 text-xl ring-1 ring-saffron/20" aria-hidden>
        {r.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{r.name}</span>
          {r.prompt && <MessageCircleQuestion className="h-3.5 w-3.5 shrink-0 text-faint" aria-label={`Asks: ${r.prompt}`} />}
        </div>
        {r.description && <p className="truncate text-xs text-muted">{r.description}</p>}
        <p className="truncate font-mono text-[10px] uppercase tracking-wider text-faint">
          <span className="text-saffron sm:hidden">
            {nf.format(r.cost)} {glyph} ·{" "}
          </span>
          {meta.join(" · ")}
        </p>
      </div>
      <span className="hidden shrink-0 font-mono text-sm tabular text-saffron sm:block">
        {nf.format(r.cost)} {glyph}
      </span>
      <div className="flex shrink-0 items-center">
        <button onClick={onEdit} disabled={isDemo} className="rounded-lg p-2 text-faint hover:bg-panel-3 hover:text-cream disabled:opacity-40" aria-label={`Edit ${r.name}`} title="Edit">
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={onToggle}
          disabled={isDemo}
          className="rounded-lg p-2 text-faint hover:bg-panel-3 hover:text-cream disabled:opacity-40"
          aria-label={`${archived ? "Restore" : "Archive"} ${r.name}`}
          title={archived ? "Restore" : "Archive"}
        >
          {archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        </button>
      </div>
    </li>
  );
}

const EMOJI_SUGGESTIONS = ["🎁", "☕", "🍕", "🧥", "🌴", "💚", "📚", "🎟️"];

type Draft = { emoji: string; name: string; description: string; cost: string; unlimited: boolean; stock: string; maxPerMember: string; prompt: string };

const toDraft = (r: Reward | null): Draft => ({
  emoji: r?.emoji ?? "🎁",
  name: r?.name ?? "",
  description: r?.description ?? "",
  cost: r ? String(r.cost) : "25",
  unlimited: r ? r.stock === undefined : true,
  stock: r?.stock !== undefined ? String(r.stock) : "10",
  maxPerMember: r?.maxPerMember !== undefined ? String(r.maxPerMember) : "",
  prompt: r?.prompt ?? "",
});

/** Blank number fields mean "none"; anything else is sent as typed so the server's bounds explain themselves. */
const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

function RewardEditor({ reward, onClose }: { reward: Reward | "new" | null; onClose: () => void }) {
  const viewer = useViewer();
  const existing = reward && reward !== "new" ? reward : null;
  const [d, setD] = useState<Draft>(() => toDraft(existing));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation(api.storeAdmin.createReward);
  const update = useMutation(api.storeAdmin.updateReward);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  const payload = {
    emoji: d.emoji,
    name: d.name,
    description: d.description || undefined,
    cost: Number(d.cost),
    stock: d.unlimited ? undefined : num(d.stock),
    maxPerMember: num(d.maxPerMember),
    prompt: d.prompt || undefined,
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (existing) await update({ rewardId: existing._id as Id<"rewards">, ...payload });
      else await create(payload);
      onClose();
    } catch (e) {
      setError(errorText(e, "Couldn't save the reward."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={reward !== null}
      onClose={onClose}
      title={existing ? "Edit reward" : "New reward"}
      subtitle={existing ? "Changes apply to new requests. Existing requests keep the price they were made at." : "Members spend the kudos they received on it."}
      className="w-[min(880px,calc(100vw-24px))]"
      footer={
        <>
          {error && (
            <span className="mr-auto flex items-center gap-1.5 text-sm text-down">
              <CircleAlert className="h-4 w-4 shrink-0" /> {error}
            </span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : existing ? "Save reward" : "Add reward"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="grid grid-cols-[88px_1fr] gap-3">
            <Field label="Emoji">
              <input className={clsx(inputCls, "text-center text-xl")} value={d.emoji} onChange={(e) => set("emoji", e.target.value)} maxLength={16} />
            </Field>
            <Field label="Name">
              <input className={inputCls} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Coffee on us" maxLength={60} autoFocus />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Emoji suggestions">
            {EMOJI_SUGGESTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => set("emoji", e)}
                className={clsx("grid h-9 w-9 place-items-center rounded-lg border text-lg transition", d.emoji === e ? "border-saffron/60 bg-saffron/10" : "border-line bg-ink/40 hover:border-line-strong")}
              >
                {e}
              </button>
            ))}
          </div>
          <Field label="Description" hint="Optional. What exactly do people get?">
            <textarea
              className={clsx(inputCls, "h-20 resize-none py-2")}
              value={d.description}
              onChange={(e) => set("description", e.target.value)}
              maxLength={280}
              placeholder="A flat white or tea from the café downstairs."
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Cost" hint={`In ${viewer.workspace.unitPlural}, 1–100,000`}>
              <div className="relative">
                <input className={clsx(inputCls, "pr-10")} type="number" min={1} max={100000} value={d.cost} onChange={(e) => set("cost", e.target.value)} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">{viewer.workspace.emojiGlyph}</span>
              </div>
            </Field>
            <Field label="Per-person limit" hint="Optional lifetime cap, e.g. 1">
              <input className={inputCls} type="number" min={1} max={100} value={d.maxPerMember} onChange={(e) => set("maxPerMember", e.target.value)} placeholder="No limit" />
            </Field>
          </div>
          <div className="rounded-xl border border-line bg-ink/30 px-3">
            <Toggle checked={d.unlimited} onChange={(v) => set("unlimited", v)} label="Unlimited stock" description="Turn off to count down the items you have." />
            {!d.unlimited && (
              <div className="pb-3">
                <input className={inputCls} type="number" min={0} max={10000} value={d.stock} onChange={(e) => set("stock", e.target.value)} aria-label="Items in stock" />
              </div>
            )}
          </div>
          <Field label="Question for the requester" hint="Optional. If set, people must answer it, e.g. “T-shirt size?”">
            <input className={inputCls} value={d.prompt} onChange={(e) => set("prompt", e.target.value)} maxLength={120} placeholder="Which charity?" />
          </Field>
        </div>
        <div className="md:sticky md:top-0 md:self-start">
          <Eyebrow className="mb-2">Preview</Eyebrow>
          <RewardCard
            reward={{ ...payload, cost: Number.isFinite(payload.cost) ? payload.cost : 0 }}
            glyph={viewer.workspace.emojiGlyph}
            action={
              <span aria-hidden className="pointer-events-none">
                <Button size="sm" variant="primary" tabIndex={-1}>
                  Redeem
                </Button>
              </span>
            }
          />
          <p className="mt-2 text-xs text-faint">How members see it in the store.</p>
        </div>
      </div>
    </Dialog>
  );
}

function StoreSettings({ isDemo }: { isDemo: boolean }) {
  const viewer = useViewer();
  const data = useQuery(api.storeAdmin.overview);
  const setEnabled = useMutation(api.storeAdmin.setStoreEnabled);
  const [error, setError] = useState<string | null>(null);
  if (!data) return <Skeleton className="h-64" />;
  const glyph = viewer.workspace.emojiGlyph;
  const hidden = data.receivedVisibility === "hidden";

  const toggle = (enabled: boolean) => {
    setError(null);
    setEnabled({ enabled }).catch((e) => setError(errorText(e, "Couldn't change the store.")));
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardHeader title="Store" subtitle="Members spend the kudos they received on rewards you stock." />
        <div className="px-5 pb-5">
          {isDemo && <DemoNotice>Store settings are read-only in the shared demo.</DemoNotice>}
          <div className="rounded-xl border border-line bg-ink/30 px-4">
            <Toggle
              checked={data.enabled}
              onChange={toggle}
              disabled={isDemo || (hidden && !data.enabled)}
              label="Open the store"
              description={
                hidden && !data.enabled
                  ? "Received kudos are hidden in this workspace. The store shows people what they received, so switch received visibility to “Only me” or “Everyone” first."
                  : data.enabled
                    ? "Members see the Store in the menu and can browse the catalog."
                    : data.activeRewards === 0
                      ? "Add a few rewards to the catalog before you open it."
                      : "Closed. Members don't see the Store yet."
              }
            />
          </div>
          {error && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-down">
              <CircleAlert className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}
          <div className="mt-5 space-y-2 text-sm leading-relaxed text-muted">
            <p>
              <b className="font-medium text-cream">How balances work.</b> A member's balance is every {viewer.workspace.unitSingular} they ever received, including before the store opened, minus what they spend. Spending never changes received totals, leaderboards or analytics.
            </p>
            <p>Balances are private: only the member and admins see them, whatever the visibility setting. Closing the store keeps every balance.</p>
          </div>
        </div>
      </Card>
      <Card className="grain overflow-hidden bg-gradient-to-br from-saffron/[0.10] via-panel to-panel p-5">
        <Eyebrow>Pricing context</Eyebrow>
        {data.totalBalance === null || data.medianBalance === null ? (
          <p className="mt-3 text-sm text-muted">Balances stay private while received kudos are hidden.</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted">Workspace balance</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <BigNumber value={data.totalBalance} className="text-4xl" />
                  <span>{glyph}</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted">Median per person</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <BigNumber value={Math.round(data.medianBalance)} className="text-4xl" />
                  <span>{glyph}</span>
                </div>
              </div>
            </div>
            <p className="mt-5 text-sm text-muted">
              Price everyday treats below the median so most people can afford one, and save the big rewards for a few months of recognition.
            </p>
          </>
        )}
        <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-faint">
          {data.activeRewards} active {data.activeRewards === 1 ? "reward" : "rewards"}
        </p>
      </Card>
    </div>
  );
}
