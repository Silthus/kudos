import clsx from "clsx";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { AnimatePresence, motion } from "motion/react";
import { Archive, BellRing, Check, ChevronDown, CircleAlert, FolderOpen, MessageCircleQuestion, PackageCheck, Pencil, Plus, RotateCcw, ShoppingBag, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { useSearchParams } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Avatar, BigNumber, Button, Card, CardHeader, Dialog, Empty, Eyebrow, Field, inputCls, Progress, Segmented, Skeleton, Toggle } from "@/components/ui";
import { nf, relativeTime } from "@/lib/format";
import { useViewer } from "@/lib/viewer";
import { AdjustmentLine, COIN, RedemptionHistory, RewardCard, signed, StatusChip } from "./Store";

const SECTIONS = ["requests", "catalog", "settings"] as const;
type Section = (typeof SECTIONS)[number];
type Reward = NonNullable<ReturnType<typeof useQuery<typeof api.storeAdmin.rewards>>>[number];

const errorText = (e: unknown, fallback: string) => (e instanceof ConvexError ? String(e.data) : fallback);

function DemoNotice({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 border border-bark/60 bg-parchment-deep/50 px-4 py-3 text-sm text-ink/75">{children}</div>;
}

export function AdminStore({ isDemo }: { isDemo: boolean }) {
  // Requests first: that's where the day-to-day work is (and where Slack links land).
  // The section lives in the URL (`&section=catalog`) so links can land on the catalog.
  const [params, setParams] = useSearchParams();
  const requested = params.get("section");
  const section: Section = SECTIONS.includes(requested as Section) ? (requested as Section) : "requests";
  const setSection = (next: Section) =>
    setParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === "requests") params.delete("section");
        else params.set("section", next);
        return params;
      },
      { replace: true },
    );
  return (
    <div>
      <div className="mb-4">
        <Segmented
          size="sm"
          label="Store section"
          value={section}
          onChange={setSection}
          options={[
            { value: "requests", label: "Requests" },
            { value: "catalog", label: "Catalog" },
            { value: "settings", label: "Settings" },
          ]}
        />
      </div>
      {section === "requests" && <Requests isDemo={isDemo} />}
      {section === "catalog" && <Catalog isDemo={isDemo} />}
      {section === "settings" && <StoreSettings isDemo={isDemo} />}
    </div>
  );
}

type QueueFilter = "open" | "fulfilled" | "declined" | "cancelled";
type QueueRow = ReturnType<typeof usePaginatedQuery<typeof api.storeAdmin.redemptions>>["results"][number];

function Requests({ isDemo }: { isDemo: boolean }) {
  const viewer = useViewer();
  const [ledgerFor, setLedgerFor] = useState<Id<"members"> | null>(null);
  const glyph = COIN;
  const [filter, setFilter] = useState<QueueFilter>("open");
  const { results, status, loadMore } = usePaginatedQuery(api.storeAdmin.redemptions, { filter }, { initialNumItems: 20 });
  const openCount = useQuery(api.storeAdmin.openCount);
  const decide = useMutation(api.storeAdmin.decide);
  // Per row, so finishing one decision never re-enables or clears another still in flight.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [declining, setDeclining] = useState<QueueRow | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const setRowError = (id: string, text: string | null) =>
    setErrors((prev) => {
      const { [id]: _dropped, ...rest } = prev;
      return text === null ? rest : { ...rest, [id]: text };
    });
  const act = async (row: QueueRow, action: "approve" | "fulfill" | "decline", note?: string) => {
    if (busy.has(row._id)) return false;
    setBusy((prev) => new Set(prev).add(row._id));
    setRowError(row._id, null);
    try {
      await decide({ redemptionId: row._id, action, note });
      return true;
    } catch (e) {
      setRowError(row._id, errorText(e, "Couldn't update the request."));
      return false;
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(row._id);
        return next;
      });
    }
  };

  const openLabel = openCount ? `Open (${openCount > 99 ? "99+" : openCount})` : "Open";
  return (
    <Card>
      <CardHeader
        title="Requests"
        subtitle={filter === "open" ? "Oldest first. The cost is already held; declining refunds it and restocks the reward." : "Finished requests, newest first."}
        action={
          <Segmented
            size="sm"
            label="Requests"
            wrap
            value={filter}
            onChange={setFilter}
            options={[
              { value: "open", label: openLabel },
              { value: "fulfilled", label: "Fulfilled" },
              { value: "declined", label: "Declined" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
        }
      />
      {status === "LoadingFirstPage" ? (
        <div className="px-5 pb-5">
          <Skeleton className="h-40" />
        </div>
      ) : results.length === 0 ? (
        <Empty icon={filter === "open" ? <BellRing className="h-7 w-7 text-ink/70" aria-hidden /> : <FolderOpen className="h-7 w-7 text-ink/70" aria-hidden />} title={filter === "open" ? "No requests waiting" : `Nothing ${filter} yet`}>
          {filter === "open" ? "When someone redeems a reward, it queues here for an admin to approve, fulfil or decline." : undefined}
        </Empty>
      ) : (
        <ul className="px-2 pb-3">
          <AnimatePresence initial={false}>
            {results.map((r) => (
              <RequestRow
                key={r._id}
                row={r}
                glyph={glyph}
                meId={viewer.member._id}
                busy={busy.has(r._id)}
                error={errors[r._id] ?? null}
                expanded={expanded === r._id}
                onToggle={() => setExpanded(expanded === r._id ? null : r._id)}
                onApprove={() => void act(r, "approve")}
                onFulfill={() => void act(r, "fulfill")}
                onDecline={() => {
                  setRowError(r._id, null);
                  setDeclining(r);
                }}
                onLedger={() => setLedgerFor(r.requester._id)}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
      {status === "CanLoadMore" && (
        <div className="px-5 pb-4">
          <Button size="sm" variant="ghost" onClick={() => loadMore(20)}>
            Show more
          </Button>
        </div>
      )}
      <DeclineDialog row={declining} glyph={glyph} onClose={() => setDeclining(null)} onDecline={(row, note) => act(row, "decline", note)} error={declining ? (errors[declining._id] ?? null) : null} />
      <LedgerDrawer memberId={ledgerFor} isDemo={isDemo} onClose={() => setLedgerFor(null)} />
    </Card>
  );
}

function RequestRow({
  row: r,
  glyph,
  meId,
  busy,
  error,
  expanded,
  onToggle,
  onApprove,
  onFulfill,
  onDecline,
  onLedger,
}: {
  row: QueueRow;
  glyph: string;
  meId: string;
  busy: boolean;
  error: string | null;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onFulfill: () => void;
  onDecline: () => void;
  onLedger: () => void;
}) {
  const open = r.status === "pending" || r.status === "approved";
  return (
    <motion.li layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden hover:bg-parchment-deep/50">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3">
        <Avatar name={r.requester.name} src={r.requester.avatarUrl} size={34} />
        <button className="min-w-0 flex-1 basis-48 text-left" onClick={onToggle} aria-expanded={expanded}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <b className="font-medium">{r.requester.name}</b>
            <span className="text-ink/75">wants</span>
            <span className="font-medium">
              <span data-user-text>{r.rewardEmoji}</span> {r.rewardName}
            </span>
            <StatusChip status={r.status} />
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/70">
            <span className="tabular text-soil">
              {nf.format(r.cost)} {r.legacy ? "kudos, old Store" : glyph}
            </span>
            <span>requested {relativeTime(r.requestedAt)}</span>
            {r.balance !== null && (
              <span className={clsx(r.negativeBalance && "font-medium text-ember-deep")}>
                balance {nf.format(r.balance)} {glyph}
                {r.negativeBalance && " (negative)"}
              </span>
            )}
            {r.requester.deactivated && <span className="bg-parchment-deep px-1.5 py-0.5 text-ink/75">left workspace</span>}
            <span className="inline-flex items-center gap-0.5 text-ink/75">
              {expanded ? "Hide details" : "Where this balance came from"}
              <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
            </span>
          </p>
          {r.answer && (
            <p className="mt-1 text-sm text-ink/75">
              <MessageCircleQuestion className="mr-1 inline h-3.5 w-3.5 text-ink/70" />
              {r.prompt && <span className="text-ink/70">{r.prompt} </span>}
              <span className="text-ink">{r.answer}</span>
            </p>
          )}
        </button>
        {open &&
          (r.canDecide ? (
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {r.status === "pending" && (
                <Button size="sm" onClick={onApprove} disabled={busy}>
                  <Check className="h-4 w-4" /> Approve
                </Button>
              )}
              <Button size="sm" variant="primary" onClick={onFulfill} disabled={busy}>
                <PackageCheck className="h-4 w-4" /> Fulfil
              </Button>
              <Button size="sm" variant="ghost" onClick={onDecline} disabled={busy}>
                Decline…
              </Button>
            </div>
          ) : (
            <span className="ml-auto shrink-0 text-xs text-ink/70">{r.isOwn ? "Your request: another admin decides" : ""}</span>
          ))}
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1.5 px-3 pb-2 text-sm text-ember-deep">
          <CircleAlert className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 px-3 pb-3 @md:pl-[58px]">
              <BalanceContext redemptionId={r._id} requester={r.requester.name} glyph={glyph} onLedger={onLedger} />
              <RedemptionHistory history={r.history} meId={meId} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function DeclineDialog({
  row,
  glyph,
  error,
  onClose,
  onDecline,
}: {
  row: QueueRow | null;
  glyph: string;
  error: string | null;
  onClose: () => void;
  onDecline: (row: QueueRow, note?: string) => Promise<boolean>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const formId = useId();
  const openedFor = row?._id ?? null;
  const [lastOpened, setLastOpened] = useState(openedFor);
  if (openedFor !== lastOpened) {
    setLastOpened(openedFor);
    if (openedFor !== null) setNote("");
  }
  return (
    <Dialog
      open={row !== null}
      onClose={onClose}
      title="Decline this request?"
      subtitle={
        row
          ? row.legacy
            ? `A request from the old kudos Store: ${row.requester.name} gets no Hog coins back (that balance was reset), and the reward is restocked.`
            : `${row.requester.name} gets ${nf.format(row.cost)} ${glyph} back and the reward is restocked.`
          : undefined
      }
      footer={
        <>
          {error && (
            <span role="alert" className="mr-auto flex items-center gap-1.5 text-sm text-ember-deep">
              <CircleAlert className="h-4 w-4 shrink-0" /> {error}
            </span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" type="submit" form={formId} disabled={busy}>
            Decline and refund
          </Button>
        </>
      }
    >
      {row && (
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            void onDecline(row, note.trim() || undefined)
              .then((ok) => ok && onClose())
              .finally(() => setBusy(false));
          }}
        >
          <p className="mb-4 text-sm text-ink/75">
            {row.rewardEmoji} <span className="text-ink">{row.rewardName}</span> for {row.requester.name}
          </p>
          <Field label="Reason" hint="Optional, but kind. The requester sees it in their history.">
            <textarea
              className={clsx(inputCls, "h-24 resize-none py-2")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="We're out of hoodies until the next order."
              data-autofocus
            />
          </Field>
        </form>
      )}
    </Dialog>
  );
}

function Catalog({ isDemo }: { isDemo: boolean }) {
  const rewards = useQuery(api.storeAdmin.rewards);
  const setStatus = useMutation(api.storeAdmin.setRewardStatus);
  const [editing, setEditing] = useState<Reward | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!rewards) return <Skeleton className="h-80" />;
  const active = rewards.filter((r) => r.status === "active");
  const archived = rewards.filter((r) => r.status === "archived");
  const glyph = COIN;

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
          <p className="mx-5 mb-2 flex items-center gap-1.5 text-sm text-ember-deep">
            <CircleAlert className="h-4 w-4" /> {error}
          </p>
        )}
        {active.length === 0 ? (
          <Empty icon={<ShoppingBag className="h-7 w-7 text-ink/70" aria-hidden />} title="No rewards yet">
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
          <div className="border-t border-parchment-deep px-2 pb-3 pt-2">
            <button onClick={() => setShowArchived((s) => !s)} className="flex items-center gap-2 px-3 py-2 text-sm text-ink/75 hover:text-ink" aria-expanded={showArchived}>
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
      <RewardEditor reward={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function RewardRow({ reward: r, glyph, isDemo, onEdit, onToggle }: { reward: Reward; glyph: string; isDemo: boolean; onEdit: () => void; onToggle: () => void }) {
  const archived = r.status === "archived";
  const meta = [
    r.stock === undefined ? "Unlimited" : r.stock === 0 ? "Sold out" : `${nf.format(r.stock)} in stock`,
    r.maxPerMember !== undefined ? `${r.maxPerMember} per person` : null,
    r.openCount > 0 ? `${nf.format(r.openCount)} open` : null,
    r.fulfilledCount > 0 ? `${nf.format(r.fulfilledCount)} fulfilled` : null,
  ].filter(Boolean);
  return (
    <li className={clsx("flex items-center gap-3 px-3 py-2.5 hover:bg-parchment-deep/50", archived && "opacity-60")}>
      <span className="grid h-10 w-10 shrink-0 place-items-center bg-lantern/10 text-xl ring-1 ring-lantern/20" data-user-text aria-hidden>
        {r.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{r.name}</span>
          {r.prompt && <MessageCircleQuestion className="h-3.5 w-3.5 shrink-0 text-ink/70" aria-label={`Asks: ${r.prompt}`} />}
          {r.pricedInKudos && (
            <span className="shrink-0 bg-ember/10 px-2 py-0.5 tabular text-[10px] text-ember-deep ring-1 ring-inset ring-ember/40" title="Priced in kudos before the Store moved to Hog coins. Members don't see it until you save a price in Hog coins.">
              Review price
            </span>
          )}
        </div>
        {r.description && <p className="truncate text-xs text-ink/75">{r.description}</p>}
        <p className="truncate tabular text-[10px] text-ink/70">
          <span className="text-soil @md:hidden">
            {nf.format(r.cost)} {r.pricedInKudos ? "kudos" : glyph},{" "}
          </span>
          {meta.join(", ")}
        </p>
      </div>
      <span className="hidden shrink-0 text-sm tabular text-soil @md:block">
        {nf.format(r.cost)} {r.pricedInKudos ? "kudos" : glyph}
      </span>
      <div className="flex shrink-0 items-center">
        <button onClick={onEdit} disabled={isDemo} className="p-2 text-ink/70 hover:bg-parchment-deep hover:text-ink disabled:opacity-40" aria-label={`Edit ${r.name}`} title="Edit">
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={onToggle}
          disabled={isDemo}
          className="p-2 text-ink/70 hover:bg-parchment-deep hover:text-ink disabled:opacity-40"
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
  const existing = reward && reward !== "new" ? reward : null;
  const [d, setD] = useState<Draft>(() => toDraft(existing));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation(api.storeAdmin.createReward);
  const update = useMutation(api.storeAdmin.updateReward);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const formId = useId();

  // Start from the reward's current values each time the editor opens.
  const openedFor = reward === null ? null : reward === "new" ? "new" : reward._id;
  const [lastOpened, setLastOpened] = useState(openedFor);
  if (openedFor !== lastOpened) {
    setLastOpened(openedFor);
    if (openedFor !== null) {
      setD(toDraft(existing));
      setError(null);
    }
  }

  const stock = d.unlimited ? undefined : Number(d.stock);
  const payload = {
    emoji: d.emoji,
    name: d.name,
    description: d.description || undefined,
    cost: Number(d.cost),
    maxPerMember: num(d.maxPerMember),
    prompt: d.prompt || undefined,
  };

  const save = async () => {
    if (!d.unlimited && d.stock.trim() === "") {
      setError("Enter how many are in stock, or switch on unlimited stock.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (existing) {
        // Stock is live (redemptions move it), so only send it when the admin changed it.
        const from = existing.stock ?? "unlimited";
        const to = stock ?? "unlimited";
        await update({ rewardId: existing._id as Id<"rewards">, ...payload, ...(from !== to ? { stock: { from, to } } : {}) });
      } else {
        await create({ ...payload, stock });
      }
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
      subtitle={existing ? "Changes apply to new requests. Existing requests keep the price they were made at." : "Members at level 5 and up request it for Hog coins, and an admin hands it over."}
      className="w-[min(880px,calc(100vw-24px))]"
      footer={
        <>
          {error && (
            <span className="mr-auto flex items-center gap-1.5 text-sm text-ember-deep">
              <CircleAlert className="h-4 w-4 shrink-0" /> {error}
            </span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} disabled={saving}>
            {saving ? "Saving…" : existing ? "Save reward" : "Add reward"}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_280px]"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-[88px_1fr] gap-3">
            <Field label="Emoji">
              <input className={clsx(inputCls, "text-center text-xl")} value={d.emoji} onChange={(e) => set("emoji", e.target.value)} maxLength={16} />
            </Field>
            <Field label="Name">
              <input className={inputCls} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Coffee on us" maxLength={60} data-autofocus />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Emoji suggestions">
            {EMOJI_SUGGESTIONS.map((e) => (
              <button
                key={e}
                type="button"
                aria-label={`Use ${e}`}
                aria-pressed={d.emoji === e}
                onClick={() => set("emoji", e)}
                className={clsx("grid h-9 w-9 place-items-center border text-lg transition", d.emoji === e ? "border-lantern/60 bg-lantern/10" : "border-parchment-deep bg-parchment-deep/40 hover:border-bark/60")}
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
            <Field label="Cost" hint="In Hog coins, 1–100,000">
              <div className="relative">
                <input className={clsx(inputCls, "pr-10")} type="number" min={1} max={100000} value={d.cost} onChange={(e) => set("cost", e.target.value)} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/70">{COIN}</span>
              </div>
            </Field>
            <Field label="Per-person limit" hint="Optional lifetime cap, e.g. 1">
              <input className={inputCls} type="number" min={1} max={100} value={d.maxPerMember} onChange={(e) => set("maxPerMember", e.target.value)} placeholder="No limit" />
            </Field>
          </div>
          <div className="border border-parchment-deep bg-parchment-deep/40 px-3">
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
            reward={{ ...payload, stock: Number.isFinite(stock) ? stock : undefined, cost: Number.isFinite(payload.cost) ? payload.cost : 0 }}
            glyph={COIN}
            action={
              <span aria-hidden className="pointer-events-none">
                <Button size="sm" variant="primary" tabIndex={-1}>
                  Redeem
                </Button>
              </span>
            }
          />
          <p className="mt-2 text-xs text-ink/70">How members see it in the store.</p>
        </div>
      </form>
    </Dialog>
  );
}

function StoreSettings({ isDemo }: { isDemo: boolean }) {
  const data = useQuery(api.storeAdmin.overview);
  const setEnabled = useMutation(api.storeAdmin.setRealRewardsEnabled);
  const [error, setError] = useState<string | null>(null);
  if (!data) return <Skeleton className="h-64" />;
  const glyph = COIN;

  const toggle = (enabled: boolean) => {
    setError(null);
    setEnabled({ enabled }).catch((e) => setError(errorText(e, "Couldn't change the store.")));
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card>
        <CardHeader title="Store" subtitle="Members spend Hog coins on game items, which apply instantly. Real rewards you stock and hand over are optional." />
        <div className="px-5 pb-5">
          {isDemo && <DemoNotice>Store settings are read-only in the shared demo.</DemoNotice>}
          <div className="border border-parchment-deep bg-parchment-deep/40 px-4">
            <Toggle
              checked={data.enabled}
              onChange={toggle}
              disabled={isDemo}
              label="Real rewards"
              description={
                !data.gameEnabled
                  ? "The Store comes with the game: switch the game on under Settings first. Hog coins are its only currency."
                  : data.enabled
                    ? "Members at level 5 and up see your catalog next to the game items, and request rewards for Hog coins. You approve and hand them over."
                    : data.activeRewards === 0
                      ? "Off. Add a few rewards to the catalog, priced in Hog coins, before you switch them on."
                      : "Off. Members only see the game items."
              }
            />
          </div>
          {data.unpricedRewards > 0 && (
            <p className="mt-3 flex items-start gap-2 border border-ember/30 bg-ember/10 px-3 py-2.5 text-sm text-ink">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ember-deep" />
              <span>
                {data.unpricedRewards} {data.unpricedRewards === 1 ? "reward was" : "rewards were"} priced in kudos before the Store moved to Hog coins. Members don't see{" "}
                {data.unpricedRewards === 1 ? "it" : "them"} until you save a price in Hog coins under Catalog.
              </span>
            </p>
          )}
          {error && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-ember-deep">
              <CircleAlert className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}
          <div className="mt-5 space-y-2 text-sm leading-relaxed text-ink/75">
            <p>
              <b className="font-medium text-ink">How balances work.</b> Members earn Hog coins by giving thoughtful kudos (1 per kudos) and reaching levels (10 each); receiving never earns coins. The balance is what they earned, minus what they spent, plus your adjustments. Kudos are only a stat: nothing buys or spends them.
            </p>
            <p>Balances are private: only the member and admins see them, whatever the visibility setting. Switching real rewards off keeps every balance, and open requests stay yours to decide.</p>
          </div>
        </div>
      </Card>
      <Card className="relative overflow-hidden p-5">
        <Eyebrow>Pricing context</Eyebrow>
        {data.totalBalance === null || data.medianBalance === null ? (
          <p className="mt-3 text-sm text-ink/75">There are no Hog coins while the game is off.</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-ink/75">Workspace balance</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <BigNumber value={data.totalBalance} className="text-4xl" />
                  <span>{glyph}</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-ink/75">Median per person</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <BigNumber value={Math.round(data.medianBalance)} className="text-4xl" />
                  <span>{glyph}</span>
                </div>
              </div>
            </div>
            <p className="mt-5 text-sm text-ink/75">
              Price everyday treats below the median so most people can afford one, and save the big rewards for a few months of recognition.
            </p>
          </>
        )}
        <p className="mt-3 tabular text-[11px] text-ink/70">
          {data.activeRewards} active {data.activeRewards === 1 ? "reward" : "rewards"}
        </p>
      </Card>
    </div>
  );
}

// ── Balance adjustments and review aids (S6) ─────────────────────────────────

type Ledger = NonNullable<ReturnType<typeof useQuery<typeof api.storeAdmin.memberLedger>>>;

/**
 * A member's Hog coins from the gatehouse's Members (or a request row): earned + adjusted − spent,
 * the latest adjustments and requests, and the way into "Adjust balance".
 */
export function LedgerDrawer({ memberId, isDemo, onClose }: { memberId: Id<"members"> | null; isDemo: boolean; onClose: () => void }) {
  const viewer = useViewer();
  const glyph = COIN;
  const ledger = useQuery(api.storeAdmin.memberLedger, memberId ? { memberId } : "skip");
  const [adjusting, setAdjusting] = useState(false);
  const blocked = ledger ? (ledger.member.isYou ? "You can't adjust your own balance. Another admin can." : isDemo ? "Balances are read-only in the shared demo." : null) : null;
  return (
    <Dialog
      variant="drawer"
      open={memberId !== null}
      onClose={onClose}
      title={ledger ? `${ledger.member.name}'s balance` : "Balance"}
      subtitle="Hog coins earned + adjustments − spent. Adjustments never count as recognition."
      footer={
        ledger && (
          <>
            {blocked && <span className="mr-auto text-xs text-ink/70">{blocked}</span>}
            <Button variant="primary" onClick={() => setAdjusting(true)} disabled={blocked !== null}>
              <SlidersHorizontal className="h-4 w-4" /> Adjust balance
            </Button>
          </>
        )
      }
    >
      {ledger === undefined ? (
        <Skeleton className="h-64" />
      ) : ledger === null ? (
        <p className="text-sm text-ink/75">Hog coins only exist while the game is on. Switch it on in the gatehouse's Settings.</p>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Avatar name={ledger.member.name} src={ledger.member.avatarUrl} size={40} />
            <div className="min-w-0">
              <div className="font-medium">{ledger.member.name}</div>
              {ledger.member.deactivated && <div className="text-xs text-ink/70">Left the workspace</div>}
            </div>
            <div className="ml-auto text-right">
              <div className="text-xs text-ink/75">Balance</div>
              <div className={clsx("flex items-baseline justify-end gap-1", ledger.balance < 0 && "text-ember-deep")}>
                <BigNumber value={ledger.balance} className="text-3xl" />
                <span>{glyph}</span>
              </div>
            </div>
          </div>
          {(() => {
            const cells: (readonly [string, string])[] = [
              ["From kudos", nf.format(ledger.fromKudos)],
              ...(ledger.fromFruit ? [["From fruit", nf.format(ledger.fromFruit)] as const] : []),
              ...(ledger.fromQuests ? [["From quests", nf.format(ledger.fromQuests)] as const] : []),
              ["From levels", nf.format(ledger.fromLevels)],
              ["Adjusted", signed(ledger.adjusted)],
              ["Spent", ledger.spent ? `−${nf.format(ledger.spent)}` : "0"],
            ];
            // One row on wider screens, or two even rows when both extra sources show.
            const columns = cells.length === 6 ? "sm:grid-cols-3" : cells.length === 5 ? "sm:grid-cols-5" : "sm:grid-cols-4";
            return (
              <dl className={clsx("grid grid-cols-2 gap-2 border border-parchment-deep bg-parchment-deep/40 p-3 text-center", columns)}>
                {cells.map(([label, value]) => (
                  <div key={label}>
                    <dt className="tabular text-[10px] text-ink/70">{label}</dt>
                    <dd className="mt-1 tabular text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            );
          })()}
          <section>
            <Eyebrow className="mb-3">Adjustments</Eyebrow>
            {ledger.adjustments.length === 0 ? (
              <p className="text-sm text-ink/70">No adjustments yet.</p>
            ) : (
              <ul className="space-y-3">
                {ledger.adjustments.map((a) => (
                  <li key={a._id}>
                    <AdjustmentLine a={a} glyph={glyph} meId={viewer.member._id} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <Eyebrow className="mb-3">Requests</Eyebrow>
            {ledger.redemptions.length === 0 ? (
              <p className="text-sm text-ink/70">Nothing redeemed yet.</p>
            ) : (
              <ul className="space-y-2">
                {ledger.redemptions.map((r) => (
                  <li key={r._id} className="flex items-center gap-2 text-sm">
                    <span aria-hidden>{r.rewardEmoji}</span>
                    <span className="min-w-0 flex-1 truncate">{r.rewardName}</span>
                    <StatusChip status={r.status} />
                    <span className={clsx("whitespace-nowrap text-right tabular", r.status === "declined" || r.status === "cancelled" ? "text-ink/70 line-through" : "text-soil")}>
                      {nf.format(r.cost)} {r.legacy ? "kudos" : glyph}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      {ledger && <AdjustBalanceDialog open={adjusting} ledger={ledger} glyph={glyph} onClose={() => setAdjusting(false)} />}
    </Dialog>
  );
}

function AdjustBalanceDialog({ open, ledger, glyph, onClose }: { open: boolean; ledger: Ledger; glyph: string; onClose: () => void }) {
  const adjust = useMutation(api.storeAdmin.adjustBalance);
  const formId = useId();
  const [direction, setDirection] = useState<"add" | "deduct">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The dialog stays mounted (focus returns to its trigger); start each opening from scratch.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDirection("add");
      setAmount("");
      setReason("");
      setError(null);
    }
  }
  const n = Number(amount);
  const valid = amount.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= 10_000;
  const delta = valid ? (direction === "add" ? n : -n) : 0;
  const reasonOk = reason.trim().length >= 3;

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      title="Adjust balance"
      subtitle={`${ledger.member.name} sees the change and your reason in their store history.`}
      footer={
        <>
          {error && (
            <span role="alert" className="mr-auto flex items-center gap-1.5 text-sm text-ember-deep">
              <CircleAlert className="h-4 w-4 shrink-0" /> {error}
            </span>
          )}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} disabled={busy || !valid || !reasonOk}>
            {busy ? "Saving…" : valid ? `${direction === "add" ? "Add" : "Deduct"} ${nf.format(n)} ${glyph}` : "Adjust"}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy || !valid || !reasonOk) return;
          setBusy(true);
          setError(null);
          adjust({ memberId: ledger.member._id, amount: delta, reason })
            .then(() => onClose())
            .catch((err) => setError(errorText(err, "Couldn't adjust the balance.")))
            .finally(() => setBusy(false));
        }}
      >
        <Segmented
          value={direction}
          onChange={setDirection}
          options={[
            { value: "add", label: "Add" },
            { value: "deduct", label: "Deduct" },
          ]}
        />
        <Field label="Amount" hint="A whole number up to 10,000.">
          <div className="flex items-center gap-2">
            <input
              className={clsx(inputCls, "w-32 tabular")}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="10"
              aria-invalid={amount !== "" && !valid}
              data-autofocus
            />
            <span>{glyph}</span>
          </div>
        </Field>
        <Field label="Reason" hint="3–200 characters. The member sees it, so keep it kind and specific.">
          <textarea
            className={clsx(inputCls, "h-20 resize-none py-2")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder={direction === "add" ? "Hackathon winner" : "Took back a hoodie that never shipped"}
          />
        </Field>
        <p className="text-sm text-ink/75">
          Balance after:{" "}
          <span className={clsx("tabular", ledger.balance + delta < 0 ? "text-ember-deep" : "text-ink")}>
            {nf.format(ledger.balance + delta)} {glyph}
          </span>
          {ledger.balance + delta < 0 && <span className="text-ink/70"> (negative balances block new requests)</span>}
        </p>
      </form>
    </Dialog>
  );
}

/**
 * "Where these coins came from": whom the requester thanked with the thoughtful kudos that earned
 * their coins in the 90 days before the request, so an admin can spot two people trading kudos
 * for coins before approving.
 */
function BalanceContext({ redemptionId, requester, glyph, onLedger }: { redemptionId: Id<"redemptions">; requester: string; glyph: string; onLedger: () => void }) {
  const viewer = useViewer();
  const context = useQuery(api.storeAdmin.redemptionContext, { redemptionId });
  return (
    <section aria-label="Where these coins came from" className="border border-parchment-deep bg-parchment-deep/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Eyebrow>Where these coins came from</Eyebrow>
        {/* Ledgers only exist while the game is on; off, requests stay decidable but not adjustable. */}
        {viewer.workspace.gameEnabled && (
          <button onClick={onLedger} className="shrink-0 whitespace-nowrap text-xs text-ink/75 underline decoration-bark/60 underline-offset-4 hover:text-ink">
            Open ledger
          </button>
        )}
      </div>
      {context === undefined ? (
        <Skeleton className="h-16" />
      ) : context.total === 0 ? (
        <p className="text-sm text-ink/75">
          {requester} earned no coins from thoughtful kudos in the {context.windowDays} days before this request: the balance comes from levels, older kudos or adjustments.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink/75">
            In the {context.windowDays} days before this request, {requester} earned{" "}
            <span className="tabular text-ink">
              {nf.format(context.total)} {glyph}
            </span>
            {context.truncated && " or more"} by thanking:
          </p>
          {context.concentrated && (
            <p role="status" className="mb-3 flex items-start gap-2 border border-ember/30 bg-ember/10 px-3 py-2 text-sm text-ink">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ember-deep" />
              <span>
                <b className="font-medium">Mostly from one person.</b> Thanking {context.thanked[0].member.name} brought {Math.round(context.thanked[0].share * 100)}% of it. Worth a look before you approve.
              </span>
            </p>
          )}
          <ul className="space-y-2">
            {context.thanked.map((g) => (
              <li key={g.member._id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 text-sm @md:grid-cols-[auto_minmax(0,7rem)_1fr_auto]">
                <Avatar name={g.member.name} src={g.member.avatarUrl} size={22} />
                <span className="truncate">
                  {g.member.name}
                  {g.member.deactivated && <span className="text-ink/70"> (left)</span>}
                </span>
                {/* On phones the bar gets its own line under the name, so it stays readable. */}
                <Progress value={g.share} max={1} height={6} className="order-last col-span-3 @md:order-none @md:col-span-1" />
                <span className="w-24 text-right text-xs tabular text-ink/75">
                  {nf.format(g.amount)} {glyph}, {Math.round(g.share * 100)}%
                </span>
              </li>
            ))}
          </ul>
          {context.otherThanked > 0 && (
            <p className="mt-2 text-xs text-ink/70">
              and {context.otherThanked} more {context.otherThanked === 1 ? "person" : "people"}
            </p>
          )}
        </>
      )}
    </section>
  );
}
