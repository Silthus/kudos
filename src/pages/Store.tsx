import clsx from "clsx";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { motion } from "motion/react";
import {
  ChevronDown,
  CircleAlert,
  Clock,
  Clover,
  EyeOff,
  Flame,
  Gift,
  Handshake,
  HeartHandshake,
  Info,
  Lamp,
  Loader2,
  MessageCircleQuestion,
  RotateCcw,
  Store as StoreIcon,
  Sun,
  Undo2,
  Users,
  Zap,
} from "lucide-react";
import { Children, useId, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { BigNumber, Button, Card, CardHeader, Dialog, Empty, Field, inputCls, PageSkeleton, Progress, Skeleton } from "@/components/ui";
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
        "group relative flex h-full flex-col border border-parchment-deep bg-parchment p-4 transition-colors hover:border-bark/60",
        dimmed && "[&>*]:opacity-60",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span data-user-text className="pixel-chip grid h-14 w-14 shrink-0 place-items-center bg-lantern/15 text-[30px]" aria-hidden>
          {reward.emoji || <Gift className="h-7 w-7 text-soil" />}
        </span>
        {badge && (
          <span
            className={clsx(
              "px-2.5 py-1 tabular text-[10px] ring-1 ring-inset",
              badge.tone === "ember" && "bg-ember/10 text-ember-deep ring-ember/40",
              badge.tone === "teal" && "bg-pond/15 text-pond-deep ring-pond/30",
              badge.tone === "muted" && "bg-parchment-deep text-ink/75 ring-bark/60",
            )}
          >
            {badge.label}
          </span>
        )}
      </div>
      <h3 data-user-text className="mt-4 font-display text-lg font-semibold leading-snug text-ink">
        {reward.name || "Untitled reward"}
      </h3>
      {reward.description && <p className="mt-1 text-sm leading-relaxed text-ink/75">{reward.description}</p>}
      {reward.prompt && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink/70">
          <MessageCircleQuestion className="h-3.5 w-3.5" /> Asks: {reward.prompt}
        </p>
      )}
      <div className="mt-auto pt-4">
        {short > 0 && (
          <div className="mb-3">
            <div className="mb-1.5 flex justify-between text-xs text-ink/75">
              <span>
                Need {nf.format(short)} more {glyph}
              </span>
              <span className="tabular">
                {nf.format(Math.max(0, balance ?? 0))}/{nf.format(reward.cost)}
              </span>
            </div>
            <Progress value={Math.max(0, balance ?? 0)} max={reward.cost} height={4} />
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-parchment-deep pt-3">
          <Price amount={reward.cost} unit={glyph} />
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
  pending: { label: "Pending", chip: "bg-lantern/10 text-soil ring-lantern/30", dot: "var(--color-lantern)", verb: "Requested" },
  approved: { label: "Approved", chip: "bg-pond/15 text-pond-deep ring-pond/30", dot: "var(--color-pond)", verb: "Approved" },
  fulfilled: { label: "Fulfilled", chip: "bg-hedge/10 text-hedge-deep ring-hedge/30", dot: "var(--color-hedge)", verb: "Fulfilled" },
  declined: { label: "Declined", chip: "bg-ember/10 text-ember-deep ring-ember/25", dot: "var(--color-ember)", verb: "Declined" },
  cancelled: { label: "Cancelled", chip: "bg-parchment-deep text-ink/70 ring-bark/60", dot: "var(--color-benchmark)", verb: "Cancelled" },
};

export function StatusChip({ status }: { status: RedemptionStatus }) {
  const meta = STATUS_META[status];
  return <span className={clsx("inline-flex shrink-0 px-2 py-0.5 tabular text-[10px] ring-1 ring-inset", meta.chip)}>{meta.label}</span>;
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

/** "+10 Hog coins “Hackathon winner” from Lena, 2d ago". Shared by the admin ledger and the member's history. */
export function AdjustmentLine({ a, glyph, meId, from }: { a: AdjustmentEntry; glyph: string; meId: string; from?: boolean }) {
  const who = a.source === "system" ? "Kudos" : a.by ? (a.by._id === meId ? "you" : a.by.name) : "a former admin";
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className={clsx("w-28 shrink-0 whitespace-nowrap text-right tabular", a.amount > 0 ? "text-hedge-deep" : "text-ember-deep")}>
        {signed(a.amount)} {glyph}
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-ink">“{a.reason}”</p>
        <p className="text-xs text-ink/70">
          {from ? "from" : "by"} {who}, {relativeTime(a.at)}
        </p>
      </div>
    </div>
  );
}

/** Who moved a request and when, with any note from the decider. */
export function RedemptionHistory({ history, meId }: { history: HistoryEntry[]; meId: string }) {
  return (
    <ol className="ml-1 space-y-2.5 border-l border-parchment-deep pl-4">
      {history.map((h, i) => (
        <li key={i} className="relative text-sm">
          <span className="absolute -left-[21px] top-[7px] h-2 w-2 ring-2 ring-parchment" style={{ background: STATUS_META[h.status].dot }} />
          <span className="text-ink">{STATUS_META[h.status].verb}</span>
          <span className="text-ink/75"> by {h.by ? (h.by._id === meId ? "you" : h.by.name) : "someone who left"}</span>
          <span className="text-ink/70">, {relativeTime(h.at)}</span>
          {h.note && <p className="mt-0.5 text-ink/75">“{h.note}”</p>}
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

/**
 * The store stall (#91, #131): Hog coins only, closed until level 5. Game items stand on the first
 * shelf, real rewards (if an admin has them on) on the second, and requests go in a ledger.
 */
export function Store() {
  const viewer = useViewer();
  const today = useWorkspaceToday();
  const shop = useQuery(api.store.shop, { today });
  if (!shop) return <PageSkeleton />;
  if (shop.access === "off") {
    return (
      <Card data-stall="off">
        <Empty icon={<StoreIcon className="h-7 w-7 text-ink/70" aria-hidden />} title="The Store comes with the game">
          Hog coins are the Store's only currency, and the game isn't on in {viewer.workspace.name}.
        </Empty>
      </Card>
    );
  }
  if (shop.access === "hidden") {
    return (
      <Card data-stall="hidden">
        <Empty icon={<EyeOff className="h-7 w-7 text-ink/70" aria-hidden />} title="You've hidden the game">
          Your coins are safe.{" "}
          <Link to="/me" className="font-medium text-soil underline underline-offset-4">
            Show the game in your cabin
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
      <section data-stall="closed" aria-labelledby="stall-closed" className="space-y-4">
        <div>
          <h2 id="stall-closed" className="font-display text-[28px] font-medium leading-9">
            The stall opens at level {shop.unlockLevel}
          </h2>
          <p className="mt-1 text-sm text-ink/75">Spend Hog coins on game items that are yours the moment you buy them.</p>
        </div>
        <div className="space-y-4">
          <Locked title="Store" level={shop.unlockLevel} how={shop.how} />
          <p className="text-sm text-ink/75">
            You're level {shop.level}.{" "}
            {shop.balance !== null ? (
              <>
                Your{" "}
                <span className="font-medium text-soil">
                  {nf.format(shop.balance)} {COIN}
                </span>{" "}
                wait for you here.
              </>
            ) : (
              "Thoughtful kudos are already collecting Hog coins for it."
            )}
          </p>
        </div>
      </section>
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
    <div data-stall="open">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p data-balance className="font-display text-[28px] font-medium leading-9">
            You have{" "}
            <span className="whitespace-nowrap">
              <HogCoin size={28} className="mr-2 -mt-1" />
              <BigNumber value={balance} className={balance < 0 ? "text-ember-deep" : "text-soil"} />
            </span>{" "}
            {COIN} to spend
          </p>
          <p className="mt-1 text-sm text-ink/75">Thoughtful kudos earn Hog coins. Game items are yours the moment you buy them.</p>
        </div>
        {viewer.workspace.isDemo && <HandBackRewards />}
      </div>
      {balance < 0 && (
        <p className="pixel-note mb-5 flex items-start gap-2.5 px-4 py-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink/70" />
          <span>
            Your balance is {nf.format(balance)} {COIN} because a revoked kudos took back coins you'd already spent, or an admin adjusted it. Spending waits until it's above zero
            again.
          </span>
        </p>
      )}
      <Shelf id="game-items" title="Game items">
        {items.map((item) => (
          <ItemCard key={item.key} item={item} balance={balance} onBuy={() => setBuying(item)} usesLeft={held[item.key] ?? 0} />
        ))}
      </Shelf>
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

/**
 * A shelf of the stall: its name on a little board, the goods standing on bark planks, two to a
 * plank in a wide window and one on a phone.
 */
function Shelf({ id, title, intro, aside, children }: { id: string; title: string; intro?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section data-shelf={id} aria-labelledby={id} className="mt-8 first:mt-0">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="font-display text-xl font-medium">
          {title}
        </h2>
        {aside}
      </div>
      {intro}
      {Children.count(children) > 0 && <ul className="grid grid-cols-1 gap-x-4 gap-y-6 @md:grid-cols-2">{children}</ul>}
    </section>
  );
}

/** What's left of an item's monthly limit, in words. */
const leftThisMonth = (item: ShopItem) => {
  if (item.perMonth === null) return null;
  const left = Math.max(0, item.perMonth - item.boughtThisMonth);
  return left === 0 ? "None left this month" : `${left} left this month`;
};

/** The shelf board under a good: the planks of neighbouring goods meet across the gap into one shelf. */
const Plank = () => <span aria-hidden className="-mx-2 mt-1.5 block h-2 bg-soil shadow-[0_2px_0_0_var(--color-bark)]" />;

/** A price: the Hog coin and the amount, in Pixelify. */
function Price({ amount, unit = COIN }: { amount: number; unit?: string }) {
  return (
    <span data-price className="whitespace-nowrap font-display text-lg font-medium tabular text-soil">
      <HogCoin size={18} className="mr-1.5 -mt-0.5" />
      {nf.format(amount)} {unit}
    </span>
  );
}

/** One good on the shelf: a parchment tag standing on a bark plank. */
function ItemCard({ item, balance, onBuy, usesLeft }: { item: ShopItem; balance: number; onBuy: () => void; usesLeft: number }) {
  const Icon = ITEM_ICONS[item.key] ?? Gift;
  const block = buyBlock(item, balance);
  const monthly = leftThisMonth(item);
  return (
    <li data-good={item.key} className="flex flex-col">
      <article className="pixel-frame flex flex-1 flex-col p-4">
        {/* A good that isn't for sale yet is dimmed; the reason under it stays readable. */}
        <div className={clsx("flex flex-1 flex-col", item.blocked && "opacity-60")}>
          <div className="flex items-start justify-between gap-3">
            {hasItemArt(item.key) ? (
              <ItemArt itemKey={item.key} />
            ) : (
              <span className="grid h-14 w-14 shrink-0 place-items-center bg-lantern/10 ring-1 ring-lantern/20" aria-hidden>
                <Icon className="h-7 w-7 text-soil" />
              </span>
            )}
            {usesLeft > 0 && (
              <span className="pixel-chip bg-lantern/15 px-2 py-0.5 text-xs text-soil tabular">
                {usesLeft} {usesLeft === 1 ? "use" : "uses"} left
              </span>
            )}
            {monthly && <span className="pixel-chip bg-parchment-deep px-2 py-0.5 text-xs text-ink tabular">{monthly}</span>}
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold leading-snug text-ink">{item.name}</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink/75">{item.description}</p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-parchment-deep pt-3">
            <Price amount={item.price} />
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
        </div>
        {block && (
          <p data-reason className="mt-2 text-xs text-ink/75">
            {block}
          </p>
        )}
      </article>
      <Plank />
    </li>
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
              <span role="alert" className="mr-auto flex items-center gap-1.5 text-sm text-ember-deep">
                <CircleAlert className="h-4 w-4 shrink-0" /> {error}
              </span>
            )}
            <Button variant="ghost" onClick={close} disabled={busy}>
              Not now
            </Button>
            <Button variant="primary" onClick={() => void submit()} disabled={busy || priceChanged}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Buying…" : `Buy for ${item ? nf.format(item.price) : ""} ${COIN}`}
            </Button>
          </>
        )
      }
    >
      {item &&
        (done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <motion.span
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="pixel-chip grid h-20 w-20 place-items-center bg-lantern/15"
              aria-hidden
            >
              <HogCoin size={48} />
            </motion.span>
            <p className="font-display text-lg font-semibold">{item.name} is yours</p>
            <p className="text-sm text-ink/75">
              Balance: {nf.format(done.balance)} {COIN}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink/75">{item.description}</p>
            {priceChanged && live && (
              <p role="alert" className="pixel-chip bg-ember/10 px-3 py-2.5 text-sm">
                The price changed to{" "}
                <b className="font-semibold">
                  {nf.format(live.price)} {COIN}
                </b>
                . Close this and take another look.
              </p>
            )}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-ink/75">Balance now</dt>
              <dd className="text-right tabular">
                {nf.format(balance)} {COIN}
              </dd>
              <dt className="text-ink/75">Balance after</dt>
              <dd className="text-right tabular text-ink">
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
    <>
      <Shelf
        id="rewards"
        title="Rewards"
        aside={
          data.openCount > 0 && (
            <a href="#my-requests" className="pixel-note inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold">
              <Clock className="h-3.5 w-3.5 text-soil" aria-hidden /> {data.openCount} of {data.maxOpen} requests open
            </a>
          )
        }
        intro={
          <>
            <p className="mb-4 text-sm text-ink/75">
              An admin approves and hands these over. {rewards.length > 0 && `${rewards.length} ${rewards.length === 1 ? "reward" : "rewards"}, and you can afford ${affordable}.`}
            </p>
            {data.openCount >= data.maxOpen && (
              <p className="pixel-note mb-5 flex items-start gap-2.5 px-4 py-3 text-sm">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink/70" aria-hidden />
                <span>You have {data.maxOpen} open requests. Once an admin finishes one, you can redeem again.</span>
              </p>
            )}
            {rewards.length === 0 && (
              <Card>
                <Empty title="The shelf is empty">
                  Your admins are still stocking it.{" "}
                  {viewer.member.isAdmin && (
                    <Link to="/admin?tab=store&section=catalog" className="font-medium text-soil underline underline-offset-4">
                      Add rewards
                    </Link>
                  )}
                </Empty>
              </Card>
            )}
          </>
        }
      >
        {rewards.map((r) => {
          const block = redeemBlock(r, data, glyph);
          return (
            <li key={r._id} className="flex flex-col">
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
                className="w-full flex-1"
              />
              <Plank />
            </li>
          );
        })}
      </Shelf>
      <MyRequests />
      <RedeemDialog
        reward={redeeming}
        live={live}
        block={liveBlock ?? null}
        balance={balance}
        onAcceptPrice={() => live && setRedeeming(live)}
        onClose={() => setRedeeming(null)}
      />
    </>
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
              <span role="alert" className="mr-auto flex items-center gap-1.5 text-sm text-ember-deep">
                <CircleAlert className="h-4 w-4 shrink-0" /> {error}
              </span>
            )}
            <Button variant="ghost" onClick={close} disabled={busy}>
              Not now
            </Button>
            <Button variant="primary" type="submit" form={formId} disabled={busy || priceChanged || blocked}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Redeeming…" : `Redeem for ${reward ? nf.format(reward.cost) : ""} ${glyph}`}
            </Button>
          </>
        )
      }
    >
      {reward &&
        (done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <motion.span
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="pixel-chip grid h-20 w-20 place-items-center bg-lantern/15 text-5xl"
              data-user-text
              aria-hidden
            >
              {reward.emoji}
            </motion.span>
            <p className="font-display text-lg font-semibold">{reward.name} is on its way to an admin</p>
            <p className="text-sm text-ink/75">
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
            <div className="flex items-center gap-3 border border-parchment-deep bg-parchment-deep/40 p-3">
              <span data-user-text className="pixel-chip grid h-12 w-12 shrink-0 place-items-center bg-lantern/15 text-2xl" aria-hidden>
                {reward.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{reward.name}</div>
                {reward.description && <p className="text-sm text-ink/75">{reward.description}</p>}
              </div>
              <span className="shrink-0 font-display text-lg font-semibold tabular text-soil">
                {nf.format(reward.cost)} {glyph}
              </span>
            </div>
            {reward.prompt && (
              <Field label={reward.prompt} hint="Your admins need this to get it to you.">
                <textarea className={clsx(inputCls, "h-20 resize-none py-2")} value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={280} required data-autofocus />
              </Field>
            )}
            {priceChanged && live && (
              <div role="alert" className="pixel-chip flex flex-wrap items-center justify-between gap-3 bg-ember/10 px-3 py-2.5 text-sm">
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
              <p role="alert" className="flex items-center gap-1.5 border border-bark/60 bg-parchment-deep/50 px-3 py-2.5 text-sm text-ink/75">
                <Info className="h-4 w-4 shrink-0 text-ink/70" /> {block.reason}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-ink/75">Balance now</dt>
              <dd className="text-right tabular">
                {nf.format(balance)} {glyph}
              </dd>
              <dt className="text-ink/75">Balance after</dt>
              <dd className={clsx("text-right tabular", after < 0 ? "text-ember-deep" : "text-ink")}>
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
      disabled={busy}
      title="The demo user is shared by all visitors: this returns the game items and rewards visitors bought. The seeded history stays."
      onClick={() => {
        setBusy(true);
        void handBack({}).finally(() => setBusy(false));
      }}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Undo2 className="h-3.5 w-3.5" aria-hidden />} Hand back what I bought
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
    <Card id="my-requests" data-ledger className="mt-8 scroll-mt-24">
      <CardHeader title="My requests" subtitle="The cost is held while an admin decides. Declined or cancelled requests are refunded in full." />
      {status === "LoadingFirstPage" ? (
        <div className="px-5 pb-5">
          <Skeleton className="h-24" />
        </div>
      ) : results.length === 0 ? (
        <Empty title="Nothing redeemed yet">Pick a reward on the shelf. Your requests and their progress show up here.</Empty>
      ) : (
        <ul className="mx-5 mb-4 border-t border-parchment-deep">
          {results.map((r) => {
            const isExpanded = expanded === r._id;
            const refunded = r.status === "declined" || r.status === "cancelled";
            return (
              <li key={r._id} className="border-b border-parchment-deep">
                <div className="flex items-center gap-3 py-2.5">
                  <span data-user-text className="pixel-chip grid h-10 w-10 shrink-0 place-items-center bg-lantern/15 text-xl" aria-hidden>
                    {r.rewardEmoji}
                  </span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => setExpanded(isExpanded ? null : r._id)} aria-expanded={isExpanded}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span data-user-text className="truncate font-medium">
                        {r.rewardName}
                      </span>
                      <StatusChip status={r.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-ink/70">
                      <span className={clsx("tabular", refunded ? "text-ink/75 line-through" : "text-soil")}>
                        {nf.format(r.cost)} {r.legacy ? "kudos" : glyph}
                      </span>
                      {/* The received-kudos balance was reset, so an old request is never refunded in coins. */}
                      {refunded && !r.legacy && <span className="text-hedge-deep"> refunded</span>}
                      {r.legacy && <span>, old kudos Store</span>}, {relativeTime(r.updatedAt)}
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
                  <button onClick={() => setExpanded(isExpanded ? null : r._id)} className="shrink-0 p-1.5 text-ink/70 hover:text-ink" aria-hidden tabIndex={-1}>
                    <ChevronDown className={clsx("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                  </button>
                </div>
                {error?.id === r._id && (
                  <p role="alert" className="flex items-center gap-1.5 pb-2 text-sm text-ember-deep">
                    <CircleAlert className="h-4 w-4 shrink-0" /> {error.text}
                  </p>
                )}
                {isExpanded && (
                  <div className="space-y-3 pb-3 pl-13">
                    {r.prompt && r.answer && (
                      <p className="text-sm">
                        <span className="text-ink/70">{r.prompt}</span> <span className="text-ink">{r.answer}</span>
                      </p>
                    )}
                    <RedemptionHistory history={r.history} meId={viewer.member._id} />
                  </div>
                )}
              </li>
            );
          })}
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

/** "42 Hog coins to spend" in the cabin, once the wallet is open: a link to the stall. */
export function StoreBalanceChip({ className }: { className?: string }) {
  const viewer = useViewer();
  const balance = useQuery(api.store.balance, viewer.workspace.storeEnabled ? {} : "skip");
  if (balance === undefined || balance === null) return null;
  return (
    <Link to="/store" className={clsx("pixel-chip inline-flex items-center gap-1.5 bg-lantern/15 px-2.5 py-1 text-xs font-medium text-soil hover:bg-lantern/30", className)}>
      <HogCoin size={14} />
      <span className={clsx("tabular", balance < 0 && "text-ember-deep")}>{nf.format(balance)}</span> {COIN} to spend
    </Link>
  );
}
