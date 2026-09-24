import clsx from "clsx";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, CircleAlert, Clock, Clover, Flame, Gift, Handshake, HeartHandshake, Info, Lamp, Loader2, MessageCircleQuestion, RotateCcw, Sun, Undo2, Users, Zap } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { BigNumber, Button, Card, CardHeader, Dialog, Empty, Field, inputCls, PageHeader, PageSkeleton, Progress, Skeleton } from "@/components/ui";
import { nf, relativeTime } from "@/lib/format";
import { useViewer } from "@/lib/viewer";
import { useWorkspaceToday } from "@/lib/period";
import { Locked } from "@/components/game";
import { hasItemArt, ItemArt } from "@/components/cosmetics";
import { HogCoin } from "@/components/HogCoin";

/** The Store's only currency (ADR 0002). */
export const COIN = "Hog coins";

export type RewardLike = {
  name: string;
  emoji: string;
  cost: number;
  description?: string;
  stock?: number;
  maxPerMember?: number;
  prompt?: string;
};

/** Stock and limit badges, most urgent first. */
function rewardBadge(r: RewardLike & { soldOut?: boolean }) {
  if (r.soldOut || r.stock === 0) return { label: "Sold out", tone: "muted" as const };
  if (r.stock !== undefined && r.stock <= 10) return { label: `${nf.format(r.stock)} left`, tone: "ember" as const };
  if (r.maxPerMember !== undefined) return { label: `${r.maxPerMember} per person`, tone: "teal" as const };
  return null;
}

/** One reward as members see it; also the live preview in the admin editor. */
export function RewardCard({
  reward,
  glyph,
  balance,
  action,
  className,
}: {
  reward: RewardLike & { soldOut?: boolean; limitReached?: boolean };
  glyph: string;
  /** Omit to render without the "need more" progress (e.g. the admin preview). */
  balance?: number;
  action?: React.ReactNode;
  className?: string;
}) {
  const badge = rewardBadge(reward);
  const short = balance !== undefined ? Math.max(0, reward.cost - balance) : 0;
  const dimmed = reward.soldOut || reward.stock === 0;
  return (
    <article
      className={clsx(
        "group relative flex h-full flex-col rounded-2xl border border-line bg-panel/80 p-4 transition-colors hover:border-line-strong",
        dimmed && "opacity-70",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <motion.span
          whileHover={{ rotate: -6, scale: 1.06 }}
          transition={{ type: "spring", bounce: 0.5, duration: 0.4 }}
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-saffron/10 text-[30px] ring-1 ring-saffron/20"
          aria-hidden
        >
          {reward.emoji || "🎁"}
        </motion.span>
        {badge && (
          <span
            className={clsx(
              "rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ring-1 ring-inset",
              badge.tone === "ember" && "bg-ember/10 text-ember ring-ember/30",
              badge.tone === "teal" && "bg-teal/15 text-teal-soft ring-teal/30",
              badge.tone === "muted" && "bg-panel-3 text-muted ring-line-strong",
            )}
          >
            {badge.label}
          </span>
        )}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold leading-snug tracking-tight text-cream">{reward.name || "Untitled reward"}</h3>
      {reward.description && <p className="mt-1 text-sm leading-relaxed text-muted">{reward.description}</p>}
      {reward.prompt && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-faint">
          <MessageCircleQuestion className="h-3.5 w-3.5" /> Asks: {reward.prompt}
        </p>
      )}
      <div className="mt-auto pt-4">
        {short > 0 && (
          <div className="mb-3">
            <div className="mb-1.5 flex justify-between text-xs text-muted">
              <span>
                Need {nf.format(short)} more {glyph}
              </span>
              <span className="font-mono tabular">
                {nf.format(Math.max(0, balance ?? 0))}/{nf.format(reward.cost)}
              </span>
            </div>
            <Progress value={Math.max(0, balance ?? 0)} max={reward.cost} height={4} />
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="font-display text-xl font-semibold tabular text-saffron">
            <HogCoin size={20} className="mr-1.5 -mt-0.5" />
            {nf.format(reward.cost)} <span className="text-base">{glyph}</span>
          </span>
          {action}
        </div>
      </div>
    </article>
  );
}

type Catalog = Extract<NonNullable<ReturnType<typeof useQuery<typeof api.store.catalog>>>, { enabled: true }>;
type CatalogReward = Catalog["rewards"][number];
type RedemptionStatus = "pending" | "approved" | "fulfilled" | "declined" | "cancelled";
type HistoryEntry = { status: RedemptionStatus; at: number; by: { _id: string; name: string } | null; note?: string };

const errorText = (e: unknown, fallback: string) => (e instanceof ConvexError ? String(e.data) : fallback);

const STATUS_META: Record<RedemptionStatus, { label: string; chip: string; dot: string; verb: string }> = {
  pending: { label: "Pending", chip: "bg-saffron/10 text-saffron ring-saffron/30", dot: "var(--color-saffron)", verb: "Requested" },
  approved: { label: "Approved", chip: "bg-teal/15 text-teal-soft ring-teal/30", dot: "var(--color-teal-soft)", verb: "Approved" },
  fulfilled: { label: "Fulfilled", chip: "bg-up/10 text-up ring-up/30", dot: "var(--color-up)", verb: "Fulfilled" },
  declined: { label: "Declined", chip: "bg-down/10 text-down ring-down/25", dot: "var(--color-down)", verb: "Declined" },
  cancelled: { label: "Cancelled", chip: "bg-panel-3 text-faint ring-line-strong", dot: "var(--color-faint)", verb: "Cancelled" },
};

export function StatusChip({ status }: { status: RedemptionStatus }) {
  const meta = STATUS_META[status];
  return <span className={clsx("inline-flex shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ring-1 ring-inset", meta.chip)}>{meta.label}</span>;
}

/** "+10", "−4": amounts that move a balance either way. */
export const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${nf.format(Math.abs(n))}`;

export type AdjustmentEntry = {
  _id: string;
  amount: number;
  reason: string;
  source: "admin" | "system";
  by: { _id: string; name: string } | null;
  at: number;
};

/** "+10 🌮 “Hackathon winner” from Lena · 2d ago". Shared by the admin ledger and the member's history. */
export function AdjustmentLine({ a, glyph, meId, from }: { a: AdjustmentEntry; glyph: string; meId: string; from?: boolean }) {
  const who = a.source === "system" ? "Kudos" : a.by ? (a.by._id === meId ? "you" : a.by.name) : "a former admin";
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className={clsx("w-28 shrink-0 whitespace-nowrap text-right font-mono tabular", a.amount > 0 ? "text-up" : "text-down")}>
        {signed(a.amount)} {glyph}
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-cream">“{a.reason}”</p>
        <p className="text-xs text-faint">
          {from ? "from" : "by"} {who} · {relativeTime(a.at)}
        </p>
      </div>
    </div>
  );
}

/** Who moved a request and when, with any note from the decider. */
export function RedemptionHistory({ history, meId }: { history: HistoryEntry[]; meId: string }) {
  return (
    <ol className="ml-1 space-y-2.5 border-l border-line pl-4">
      {history.map((h, i) => (
        <li key={i} className="relative text-sm">
          <span className="absolute -left-[21px] top-[7px] h-2 w-2 rounded-full ring-2 ring-panel" style={{ background: STATUS_META[h.status].dot }} />
          <span className="text-cream">{STATUS_META[h.status].verb}</span>
          <span className="text-muted"> by {h.by ? (h.by._id === meId ? "you" : h.by.name) : "someone who left"}</span>
          <span className="text-faint"> · {relativeTime(h.at)}</span>
          {h.note && <p className="mt-0.5 text-muted">“{h.note}”</p>}
        </li>
      ))}
    </ol>
  );
}

/** Why a reward can't be redeemed right now, or null when it can. */
function redeemBlock(r: CatalogReward, data: Catalog, glyph: string): { label: string; reason: string } | null {
  if (r.soldOut) return { label: "Sold out", reason: "Sold out. It's back once an admin restocks it." };
  if (r.limitReached) return { label: "Redeemed", reason: `You've redeemed this. It's ${r.maxPerMember} per person.` };
  if (!r.affordable) return { label: "Redeem", reason: `Need ${nf.format(r.cost - data.balance)} more ${glyph}` };
  if (data.openCount >= data.maxOpen) return { label: "Redeem", reason: `${data.maxOpen} open requests: wait for one to finish` };
  return null;
}

type Shop = NonNullable<ReturnType<typeof useQuery<typeof api.store.shop>>>;
type OpenShop = Extract<Shop, { access: "open" }>;
type ShopItem = OpenShop["items"][number];

/** The Store (#91): Hog coins only, locked until level 5, game items first, real rewards if an admin has them on. */
export function Store() {
  const viewer = useViewer();
  const today = useWorkspaceToday();
  const shop = useQuery(api.store.shop, { today });
  if (!shop) return <PageSkeleton />;
  if (shop.access === "off") {
    return (
      <Card>
        <Empty icon="🎁" title="The Store comes with the game">
          Hog coins are the Store's only currency, and the game isn't on in {viewer.workspace.name}.
        </Empty>
      </Card>
    );
  }
  if (shop.access === "hidden") {
    return (
      <Card>
        <Empty icon="🙈" title="You've hidden the game">
          Your coins are safe.{" "}
          <Link to="/me" className="font-medium text-saffron underline-offset-4 hover:underline">
            Show the game on Me
          </Link>{" "}
          to shop again.
        </Empty>
      </Card>
    );
  }
  if (shop.access === "locked") return <LockedStore shop={shop} />;
  return <OpenStore shop={shop} />;
}

function LockedStore({ shop }: { shop: Extract<Shop, { access: "locked" }> }) {
  return (
    <div>
      <PageHeader eyebrow="Store" title={<>Opens at level {shop.unlockLevel}</>} subtitle="Spend Hog coins on game items that are yours the moment you buy them." />
      <Card className="p-5">
        <div className="max-w-xl space-y-4">
          <Locked title="Store" level={shop.unlockLevel} how={shop.how} />
          <p className="text-sm text-muted">
            You're level {shop.level}.{" "}
            {shop.balance !== null ? (
              <>
                Your <span className="font-medium text-saffron">{nf.format(shop.balance)} {COIN}</span> wait for you here.
              </>
            ) : (
              "Thoughtful kudos are already collecting Hog coins for it."
            )}
          </p>
        </div>
      </Card>
      {/* Requests made before (e.g. in the received-kudos Store) stay in view while the Store is locked. */}
      <MyRequests onlyIfAny />
    </div>
  );
}

function OpenStore({ shop }: { shop: OpenShop }) {
  const viewer = useViewer();
  const [buying, setBuying] = useState<ShopItem | null>(null);
  const { balance, items } = shop;
  const game = useQuery(api.game.mine);
  // Items kept until used (#97): how many are left to use.
  const held: Record<string, number> = { luckyCharm: game?.luckyCharms ?? 0, sunlamp: game?.sunlamps ?? 0, lantern: game?.lanterns ?? 0 };
  const live = buying ? (items.find((i) => i.key === buying.key) ?? null) : null;
  return (
    <div>
      <PageHeader
        eyebrow="Store"
        title={
          <>
            You have{" "}
            <span className="whitespace-nowrap">
              <HogCoin size={34} className="mr-2 -mt-1" />
              <BigNumber value={balance} className={balance < 0 ? "text-down" : "text-saffron"} />
            </span>{" "}
            {COIN} to spend
          </>
        }
        subtitle="Thoughtful kudos earn Hog coins. Game items are yours the moment you buy them."
        action={viewer.workspace.isDemo && <HandBackRewards />}
      />
      {balance < 0 && (
        <p className="mb-5 flex items-start gap-2.5 rounded-xl border border-line-strong bg-panel-2/60 px-4 py-3 text-sm text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
          <span>
            Your balance is {nf.format(balance)} {COIN} because a revoked kudos took back coins you'd already spent, or an admin adjusted it. Spending waits until it's above zero again.
          </span>
        </p>
      )}
      <section aria-labelledby="game-items">
        <h2 id="game-items" className="mb-3 font-display text-lg font-semibold">
          Game items
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, i) => (
            <motion.div key={item.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.04 }}>
              <ItemCard item={item} balance={balance} onBuy={() => setBuying(item)} usesLeft={held[item.key] ?? 0} />
            </motion.div>
          ))}
        </div>
      </section>
      {/* Switching real rewards off leaves open requests with the admins: they stay in view. */}
      {shop.realRewards ? <RealRewards /> : <MyRequests onlyIfAny />}
      <MyAdjustments />
      <BuyDialog item={buying} live={live} balance={balance} onClose={() => setBuying(null)} />
    </div>
  );
}

const ITEM_ICONS: Record<string, typeof Gift> = {
  spreeJoin: Users,
  skillReset: RotateCcw,
  luckyCharm: Clover,
  sunlamp: Sun,
  lantern: Lamp,
  boosterDouble: Zap,
  boosterNewConnections: Handshake,
  boosterRekindles: Flame,
  boosterUnsung: HeartHandshake,
};

/** Why an item can't be bought now, or null when it can. */
function buyBlock(item: ShopItem, balance: number): string | null {
  if (item.blocked) return item.blocked;
  if (balance < 0) return "Spending waits until your balance is above zero";
  if (!item.affordable) return `Need ${nf.format(item.price - balance)} more ${COIN}`;
  return null;
}

function ItemCard({ item, balance, onBuy, usesLeft }: { item: ShopItem; balance: number; onBuy: () => void; usesLeft: number }) {
  const Icon = ITEM_ICONS[item.key] ?? Gift;
  const block = buyBlock(item, balance);
  return (
    <article className={clsx("flex h-full flex-col rounded-2xl border border-line bg-panel/80 p-4", item.blocked && "opacity-70")}>
      <div className="flex items-start justify-between gap-3">
        {hasItemArt(item.key) ? (
          <ItemArt itemKey={item.key} />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-saffron/10 ring-1 ring-saffron/20" aria-hidden>
            <Icon className="h-7 w-7 text-saffron" />
          </span>
        )}
        {usesLeft > 0 && (
          <span className="rounded-full bg-saffron/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-saffron ring-1 ring-inset ring-saffron/30">
            {usesLeft} {usesLeft === 1 ? "use" : "uses"} left
          </span>
        )}
        {item.perMonth !== null && (
          <span className="rounded-full bg-teal/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-teal-soft ring-1 ring-inset ring-teal/30">
            {item.boughtThisMonth}/{item.perMonth} this month
          </span>
        )}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold leading-snug tracking-tight text-cream">{item.name}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{item.description}</p>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
        <span className="font-display text-xl font-semibold tabular text-saffron">
          <HogCoin size={20} className="mr-1.5 -mt-0.5" />
          {nf.format(item.price)} <span className="text-base">{COIN}</span>
        </span>
        {block ? (
          <span title={block}>
            <Button size="sm" disabled aria-label={`${item.name}: ${block}`}>
              Buy
            </Button>
          </span>
        ) : (
          <Button size="sm" variant="primary" onClick={onBuy} aria-label={`Buy ${item.name}`}>
            Buy
          </Button>
        )}
      </div>
      {block && <p className="mt-2 text-xs text-faint">{block}</p>}
    </article>
  );
}

function BuyDialog({ item, live, balance, onClose }: { item: ShopItem | null; live: ShopItem | null; balance: number; onClose: () => void }) {
  const buy = useMutation(api.store.buyItem);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ balance: number } | null>(null);
  const openedFor = item?.key ?? null;
  const [lastOpened, setLastOpened] = useState(openedFor);
  if (openedFor !== lastOpened) {
    setLastOpened(openedFor);
    if (openedFor !== null) {
      setError(null);
      setDone(null);
    }
  }
  const submit = async () => {
    if (!item || busy) return;
    setBusy(true);
    setError(null);
    try {
      setDone(await buy({ item: item.key, expectedPrice: item.price }));
    } catch (e) {
      setError(errorText(e, "Couldn't buy this. Try again in a moment."));
    } finally {
      setBusy(false);
    }
  };
  const priceChanged = !done && item !== null && live !== null && live.price !== item.price;
  const close = () => !busy && onClose();
  return (
    <Dialog
      open={item !== null}
      onClose={close}
      title={done ? "It's yours" : `Buy ${item?.name ?? ""}?`}
      subtitle={done ? undefined : "It applies right away. No approval needed."}
      footer={
        done ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            {error && (
              <span role="alert" className="mr-auto flex items-center gap-1.5 text-sm text-down">
                <CircleAlert className="h-4 w-4 shrink-0" /> {error}
              </span>
            )}
            <Button variant="ghost" onClick={close} disabled={busy}>
              Not now
            </Button>
            <Button variant="primary" onClick={() => void submit()} disabled={busy || priceChanged}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Buying…" : `Buy · ${item ? nf.format(item.price) : ""} ${COIN}`}
            </Button>
          </>
        )
      }
    >
      {item &&
        (done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <motion.span
              initial={{ scale: 0.3, rotate: -12, opacity: 0 }}
              animate={{ scale: [0.3, 1.25, 1], rotate: [-12, 6, 0], opacity: 1 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="grid h-20 w-20 place-items-center rounded-3xl bg-saffron/15 ring-1 ring-saffron/30"
              aria-hidden
            >
              <HogCoin size={48} />
            </motion.span>
            <p className="font-display text-lg font-semibold">{item.name} is yours</p>
            <p className="text-sm text-muted">
              Balance: {nf.format(done.balance)} {COIN}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">{item.description}</p>
            {priceChanged && live && (
              <p role="alert" className="rounded-xl border border-ember/30 bg-ember/10 px-3 py-2.5 text-sm">
                The price changed to <b className="font-semibold">{nf.format(live.price)} {COIN}</b>. Close this and take another look.
              </p>
            )}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted">Balance now</dt>
              <dd className="text-right font-mono tabular">
                {nf.format(balance)} {COIN}
              </dd>
              <dt className="text-muted">Balance after</dt>
              <dd className="text-right font-mono tabular text-cream">
                {nf.format(balance - item.price)} {COIN}
              </dd>
            </dl>
          </div>
        ))}
    </Dialog>
  );
}

/** Real rewards (behind the admin switch): the catalog, redeeming with approval, and the member's requests. */
function RealRewards() {
  const viewer = useViewer();
  const data = useQuery(api.store.catalog);
  const [redeeming, setRedeeming] = useState<CatalogReward | null>(null);
  if (!data) return <Skeleton className="mt-8 h-40" />;
  if (!data.enabled) return null;
  const glyph = COIN;
  const { balance, rewards } = data;
  const affordable = rewards.filter((r) => r.affordable && !r.soldOut).length;
  // The dialog confirms the price the member saw (D11); the live copy only flags changes.
  const live = redeeming ? (rewards.find((r) => r._id === redeeming._id) ?? null) : null;
  const liveBlock = redeeming && (live ? redeemBlock(live, data, glyph) : { label: "", reason: "This reward isn't in the store any more." });

  return (
    <section aria-labelledby="rewards" className="mt-10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="rewards" className="font-display text-lg font-semibold">
          Rewards
        </h2>
        {data.openCount > 0 && (
          <a href="#my-requests" className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-panel-2 px-3 py-1.5 text-xs text-muted hover:text-cream">
            <Clock className="h-3.5 w-3.5 text-saffron" /> {data.openCount} of {data.maxOpen} requests open
          </a>
        )}
      </div>
      <p className="mb-4 text-sm text-faint">
        An admin approves and hands these over.{" "}
        {rewards.length > 0 && (
          <>
            {rewards.length} {rewards.length === 1 ? "reward" : "rewards"} · you can afford {affordable}
          </>
        )}
      </p>
      {data.openCount >= data.maxOpen && (
        <p className="mb-5 flex items-start gap-2.5 rounded-xl border border-line-strong bg-panel-2/60 px-4 py-3 text-sm text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
          <span>You have {data.maxOpen} open requests. Once an admin finishes one, you can redeem again.</span>
        </p>
      )}
      {rewards.length === 0 ? (
        <Card>
          <Empty icon="🛍️" title="The shelves are empty">
            Your admins are still stocking the store.{" "}
            {viewer.member.isAdmin && (
              <Link to="/admin?tab=store&section=catalog" className="font-medium text-saffron underline-offset-4 hover:underline">
                Add rewards
              </Link>
            )}
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rewards.map((r, i) => {
            const block = redeemBlock(r, data, glyph);
            return (
              <motion.div key={r._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.04 }}>
                <RewardCard
                  reward={r}
                  glyph={glyph}
                  balance={balance}
                  action={
                    block ? (
                      // Disabled buttons don't show tooltips, so the wrapper carries the reason.
                      <span title={block.reason}>
                        <Button size="sm" disabled aria-label={`${r.name}: ${block.reason}`}>
                          {block.label}
                        </Button>
                      </span>
                    ) : (
                      <Button size="sm" variant="primary" onClick={() => setRedeeming(r)} aria-label={`Redeem ${r.name}`}>
                        Redeem
                      </Button>
                    )
                  }
                />
              </motion.div>
            );
          })}
        </div>
      )}
      <MyRequests />
      <RedeemDialog
        reward={redeeming}
        live={live}
        block={liveBlock ?? null}
        balance={balance}
        onAcceptPrice={() => live && setRedeeming(live)}
        onClose={() => setRedeeming(null)}
      />
    </section>
  );
}

function RedeemDialog({
  reward,
  live,
  block,
  balance,
  onAcceptPrice,
  onClose,
}: {
  /** The reward as the member saw it when they clicked Redeem. */
  reward: CatalogReward | null;
  /** The same reward now, or null once it's gone from the store. */
  live: CatalogReward | null;
  block: { reason: string } | null;
  balance: number;
  onAcceptPrice: () => void;
  onClose: () => void;
}) {
  const glyph = COIN;
  const redeem = useMutation(api.store.redeem);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ balance: number } | null>(null);
  const formId = useId();

  // Start fresh each time the dialog opens for a reward.
  const openedFor = reward?._id ?? null;
  const [lastOpened, setLastOpened] = useState(openedFor);
  if (openedFor !== lastOpened) {
    setLastOpened(openedFor);
    if (openedFor !== null) {
      setAnswer("");
      setError(null);
      setDone(null);
    }
  }

  const submit = async () => {
    if (!reward || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await redeem({ rewardId: reward._id, expectedCost: reward.cost, answer: reward.prompt ? answer : undefined });
      setDone({ balance: result.balance });
    } catch (e) {
      setError(errorText(e, "Couldn't redeem this. Try again in a moment."));
    } finally {
      setBusy(false);
    }
  };

  const after = balance - (reward?.cost ?? 0);
  const priceChanged = !done && reward !== null && live !== null && live.cost !== reward.cost;
  const blocked = !done && !priceChanged && block !== null;
  // Closing mid-request would hide whether it went through.
  const close = () => !busy && onClose();
  return (
    <Dialog
      open={reward !== null}
      onClose={close}
      title={done ? "Request sent" : "Redeem this reward?"}
      subtitle={done ? undefined : "The cost comes off your balance now. If an admin declines, you get it back."}
      footer={
        done ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            {error && (
              <span role="alert" className="mr-auto flex items-center gap-1.5 text-sm text-down">
                <CircleAlert className="h-4 w-4 shrink-0" /> {error}
              </span>
            )}
            <Button variant="ghost" onClick={close} disabled={busy}>
              Not now
            </Button>
            <Button variant="primary" type="submit" form={formId} disabled={busy || priceChanged || blocked}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Redeeming…" : `Confirm · ${reward ? nf.format(reward.cost) : ""} ${glyph}`}
            </Button>
          </>
        )
      }
    >
      {reward &&
        (done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <motion.span
              initial={{ scale: 0.3, rotate: -12, opacity: 0 }}
              animate={{ scale: [0.3, 1.25, 1], rotate: [-12, 6, 0], opacity: 1 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="grid h-20 w-20 place-items-center rounded-3xl bg-saffron/15 text-5xl ring-1 ring-saffron/30"
              aria-hidden
            >
              {reward.emoji}
            </motion.span>
            <p className="font-display text-lg font-semibold">{reward.name} is on its way to an admin</p>
            <p className="text-sm text-muted">
              You'll see every step under My requests. Balance: {nf.format(done.balance)} {glyph}
            </p>
          </div>
        ) : (
          <form
            id={formId}
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 rounded-xl border border-line bg-ink/30 p-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-saffron/10 text-2xl ring-1 ring-saffron/20" aria-hidden>
                {reward.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{reward.name}</div>
                {reward.description && <p className="text-sm text-muted">{reward.description}</p>}
              </div>
              <span className="shrink-0 font-display text-lg font-semibold tabular text-saffron">
                {nf.format(reward.cost)} {glyph}
              </span>
            </div>
            {reward.prompt && (
              <Field label={reward.prompt} hint="Your admins need this to get it to you.">
                <textarea
                  className={clsx(inputCls, "h-20 resize-none py-2")}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  maxLength={280}
                  required
                  data-autofocus
                />
              </Field>
            )}
            {priceChanged && live && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ember/30 bg-ember/10 px-3 py-2.5 text-sm">
                <span>
                  The price changed to{" "}
                  <b className="font-semibold">
                    {nf.format(live.cost)} {glyph}
                  </b>
                  . Take another look.
                </span>
                <Button size="sm" type="button" onClick={onAcceptPrice}>
                  Use the new price
                </Button>
              </div>
            )}
            {blocked && block && (
              <p role="alert" className="flex items-center gap-1.5 rounded-xl border border-line-strong bg-panel-2/60 px-3 py-2.5 text-sm text-muted">
                <Info className="h-4 w-4 shrink-0 text-faint" /> {block.reason}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted">Balance now</dt>
              <dd className="text-right font-mono tabular">
                {nf.format(balance)} {glyph}
              </dd>
              <dt className="text-muted">Balance after</dt>
              <dd className={clsx("text-right font-mono tabular", after < 0 ? "text-down" : "text-cream")}>
                {nf.format(after)} {glyph}
              </dd>
            </dl>
          </form>
        ))}
    </Dialog>
  );
}

/** The demo user is shared by every visitor, so anyone can put back what visitors bought or redeemed. */
function HandBackRewards() {
  const handBack = useMutation(api.demo.handBackRewards);
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      title="The demo user is shared by all visitors: this returns the game items and rewards visitors bought. The seeded history stays."
      onClick={() => {
        setBusy(true);
        void handBack({}).finally(() => setBusy(false));
      }}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Hand back what I bought
    </Button>
  );
}

/** The member's requests for real rewards. `onlyIfAny`: nothing at all until they made one. */
function MyRequests({ onlyIfAny = false }: { onlyIfAny?: boolean }) {
  const viewer = useViewer();
  const glyph = COIN;
  const { results, status, loadMore } = usePaginatedQuery(api.store.myRedemptions, {}, { initialNumItems: 10 });
  const cancel = useMutation(api.store.cancel);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  if (onlyIfAny && results.length === 0) return null;

  const doCancel = (id: Id<"redemptions">) => {
    if (cancelling) return;
    setError(null);
    setCancelling(id);
    cancel({ redemptionId: id })
      .then(() => setConfirming(null))
      .catch((e) => setError({ id, text: errorText(e, "Couldn't cancel the request.") }))
      .finally(() => setCancelling(null));
  };

  return (
    <Card id="my-requests" className="mt-8 scroll-mt-24">
      <CardHeader
        title="My requests"
        subtitle="The cost is held while an admin decides. Declined or cancelled requests are refunded in full."
      />
      {status === "LoadingFirstPage" ? (
        <div className="px-5 pb-5">
          <Skeleton className="h-24" />
        </div>
      ) : results.length === 0 ? (
        <Empty icon="🧾" title="Nothing redeemed yet">
          Pick a reward above. Your requests and their progress show up here.
        </Empty>
      ) : (
        <ul className="px-2 pb-3">
          <AnimatePresence initial={false}>
            {results.map((r) => {
              const isExpanded = expanded === r._id;
              const refunded = r.status === "declined" || r.status === "cancelled";
              return (
                <motion.li key={r._id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl hover:bg-panel-2/40">
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-saffron/10 text-xl ring-1 ring-saffron/20" aria-hidden>
                      {r.rewardEmoji}
                    </span>
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setExpanded(isExpanded ? null : r._id)}
                      aria-expanded={isExpanded}
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate font-medium">{r.rewardName}</span>
                        <StatusChip status={r.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-faint">
                        <span className={clsx("font-mono tabular", refunded ? "text-muted line-through" : "text-saffron")}>
                          {nf.format(r.cost)} {r.legacy ? "kudos" : glyph}
                        </span>
                        {/* The received-kudos balance was reset, so an old request is never refunded in coins. */}
                        {refunded && !r.legacy && <span className="text-up"> refunded</span>}
                        {r.legacy && <span> · old kudos Store</span>} · {relativeTime(r.updatedAt)}
                      </p>
                    </button>
                    {r.status === "pending" &&
                      (confirming === r._id ? (
                        <span className="flex shrink-0 items-center gap-1">
                          <Button size="sm" variant="danger" onClick={() => doCancel(r._id)} disabled={cancelling === r._id}>
                            {cancelling === r._id ? "Cancelling…" : "Cancel request"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                            Keep
                          </Button>
                        </span>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setConfirming(r._id)} className="shrink-0">
                          Cancel
                        </Button>
                      ))}
                    <button onClick={() => setExpanded(isExpanded ? null : r._id)} className="shrink-0 rounded-lg p-1.5 text-faint hover:text-cream" aria-hidden tabIndex={-1}>
                      <ChevronDown className={clsx("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                    </button>
                  </div>
                  {error?.id === r._id && (
                    <p role="alert" className="flex items-center gap-1.5 px-3 pb-2 text-sm text-down">
                      <CircleAlert className="h-4 w-4 shrink-0" /> {error.text}
                    </p>
                  )}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="space-y-3 px-3 pb-3 pl-16">
                          {r.prompt && r.answer && (
                            <p className="text-sm">
                              <span className="text-faint">{r.prompt}</span> <span className="text-cream">{r.answer}</span>
                            </p>
                          )}
                          <RedemptionHistory history={r.history} meId={viewer.member._id} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      {status === "CanLoadMore" && (
        <div className="px-5 pb-4">
          <Button size="sm" variant="ghost" onClick={() => loadMore(10)}>
            Show older requests
          </Button>
        </div>
      )}
    </Card>
  );
}

/**
 * Grants and corrections to the member's Hog coins, newest first ("+10 Hog coins from Lena"). Only
 * shown once there is one: most people never get an adjustment.
 */
function MyAdjustments() {
  const viewer = useViewer();
  const { results, status, loadMore } = usePaginatedQuery(api.store.myAdjustments, {}, { initialNumItems: 10 });
  if (results.length === 0) return null;
  return (
    <Card id="balance-adjustments" className="mt-4 scroll-mt-24">
      <CardHeader title="Balance adjustments" subtitle="Hog coins your admins granted or corrected. They change what you can spend, never your kudos." />
      <ul className="space-y-3 px-5 pb-5">
        {results.map((a) => (
          <li key={a._id}>
            <AdjustmentLine a={a} glyph={COIN} meId={viewer.member._id} from />
          </li>
        ))}
      </ul>
      {status === "CanLoadMore" && (
        <div className="px-5 pb-4">
          <Button size="sm" variant="ghost" onClick={() => loadMore(10)}>
            Show older adjustments
          </Button>
        </div>
      )}
    </Card>
  );
}

/** "42 Hog coins to spend →" on Me, once the wallet is open. */
export function StoreBalanceChip({ className }: { className?: string }) {
  const viewer = useViewer();
  const balance = useQuery(api.store.balance, viewer.workspace.storeEnabled ? {} : "skip");
  if (balance === undefined || balance === null) return null;
  return (
    <Link
      to="/store"
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border border-saffron/30 bg-saffron/10 px-2.5 py-1 text-xs font-medium text-saffron transition hover:bg-saffron/15",
        className,
      )}
    >
      <HogCoin size={14} />
      <span className={clsx("tabular", balance < 0 && "text-down")}>{nf.format(balance)}</span> {COIN} to spend →
    </Link>
  );
}
