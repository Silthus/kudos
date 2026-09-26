import clsx from "clsx";
import { useMutation, useQuery } from "convex/react";
import { House, Lamp } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { api } from "../../convex/_generated/api";
import { HOME_STAGE_BY_ID, type HomeStageId } from "../../convex/lib/homes";
import { Locked } from "@/components/game";
import { HogCoin } from "@/components/HogCoin";
import { Button, Card, Empty, PageSkeleton, Progress, Skeleton, inputCls } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { useViewer } from "@/lib/viewer";
import { canopyScene, freePlots, homeSprite, nextFreePlot, ringHomes, ringPoint, type HomeOnRing } from "@/world/homes";
import { useClockNow, useHomeRing } from "@/world/homeRing";
import { Art, FramedAvatar } from "@/components/cosmetics";
import { cosmeticByKey } from "../../convex/lib/cosmetics";
import { PixelArt } from "@/world/PixelArt";
import { errorText } from "@/lib/errors";

/**
 * Homes on the tree (#160, plan #152 S5): the windows of the homes district and the canopy.
 *
 * - **Your home** (`/homes`, the homes district's gate): buy a plot on the mini ring, or the next
 *   free one; then build your next stage (its cost, a star fruit's discount, its days), watch the
 *   days count down, and read the lanterns visitors left in your guestbook. The neighbours' homes to
 *   visit are listed below.
 * - **A teammate's home** (`/homes/:memberId`, from the map or their card): who, what stage, their
 *   guestbook, and "Leave a lantern", once a week.
 * - **The canopy** (`/canopy`, at the world tree): the tree seen from above at night, every home lit.
 */

const linkCls = "font-semibold text-ember-deep underline decoration-2 underline-offset-4";
const days = (n: number) => (n === 1 ? "1 day" : `${n} days`);
const stageName = (id: HomeStageId) => HOME_STAGE_BY_ID[id].name;
/** "the leaf hut", "the scarves and planks": a stage in a sentence. */
const theStage = (id: HomeStageId) => `the ${stageName(id).toLowerCase()}`;

/** A home's picture on a patch of sand. */
function HomePicture({ stage, building, label }: { stage: HomeStageId; building?: boolean; label: string }) {
  const sprite = useMemo(() => homeSprite(stage, building), [stage, building]);
  return (
    <div className="grid h-28 w-28 shrink-0 place-items-end justify-center bg-dusk pb-2 shadow-[inset_0_-14px_0_0_var(--color-sand-deep)]">
      <PixelArt map={sprite} label={label} className="h-24 max-w-24" />
    </div>
  );
}

type Lantern = { _id: string; by: string; note: string; at: number; canTakeDown: boolean };

function Guestbook({ lanterns }: { lanterns: Lantern[] }) {
  const takeDown = useMutation(api.homes.takeDownLantern);
  return (
    <Card className="p-4" data-guestbook>
      <h2 className="font-display text-lg font-medium text-ink">Guestbook</h2>
      {lanterns.length === 0 ? (
        <p className="mt-1 text-sm text-ink/75">No lanterns yet. Visitors leave one a week.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {lanterns.map((l) => (
            <li key={l._id} className="flex items-start gap-2 bg-lantern/20 px-2 py-1.5 text-sm text-ink">
              <Lamp className="mt-0.5 h-4 w-4 shrink-0 text-soil" aria-hidden />
              <div className="min-w-0 flex-1">
                <span className="font-semibold">{l.by}</span> <span className="text-xs text-ink/75">{relativeTime(l.at)}</span>
                <p data-user-text className="break-words">
                  “{l.note}”
                </p>
              </div>
              {l.canTakeDown && (
                <button type="button" className="shrink-0 text-xs font-semibold text-ink/75 underline" onClick={() => void takeDown({ lanternId: l._id as never }).catch(() => {})}>
                  Take down
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * The ring from above at night (the canopy's scene, every home lit), a square on each free plot to
 * pick: the lit ones are taken, and say whose they are.
 */
function PlotPicker({ taken, picked, onPick }: { taken: HomeOnRing[]; picked: number | null; onPick: (plot: number) => void }) {
  const { plots, seed } = useHomeRing();
  const scene = useMemo(() => canopyScene(plots, taken, seed), [plots, taken, seed]);
  const owner = new Map(taken.map((h) => [h.plot, h.name]));
  const points = plots.flatMap((t, i) => (t ? [{ i, ...ringPoint(t) }] : []));
  const [w, h] = [scene.rows[0].length, scene.rows.length];
  return (
    <div data-plot-picker className="relative mx-auto w-full max-w-80">
      <PixelArt map={scene} className="block w-full" />
      {points.map((p) => {
        const state = owner.has(p.i) ? "taken" : picked === p.i ? "picked" : "free";
        return (
          <button
            key={p.i}
            type="button"
            data-plot-pick={p.i}
            data-state={owner.has(p.i) ? "taken" : "free"}
            disabled={owner.has(p.i)}
            aria-pressed={picked === p.i}
            aria-label={owner.has(p.i) ? `Plot ${p.i + 1}: ${owner.get(p.i)}'s home` : `Plot ${p.i + 1}, free`}
            title={owner.has(p.i) ? `${owner.get(p.i)}'s home` : `Plot ${p.i + 1}`}
            onClick={() => onPick(p.i)}
            className={clsx(
              "absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 border-2",
              state === "taken" && "border-transparent bg-transparent",
              state === "free" && "cursor-pointer border-bark bg-parchment hover:bg-lantern",
              state === "picked" && "border-dusk-deep bg-lantern",
            )}
            style={{ left: `${((w / 2 + p.x + 0.5) / w) * 100}%`, top: `${((h / 2 + p.y + 0.5) / h) * 100}%` }}
          />
        );
      })}
    </div>
  );
}

function BuyPlot({ price, balance, taken }: { price: number; balance: number; taken: HomeOnRing[] }) {
  const { plots } = useHomeRing();
  const buy = useMutation(api.homes.buy);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = nextFreePlot(plots, taken);
  const free = freePlots(plots, taken);
  const pick = picked !== null && free.includes(picked) ? picked : null;
  const short = Math.max(0, price - balance);
  const onBuy = async (plot: number) => {
    setBusy(true);
    setError(null);
    try {
      await buy({ plot });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="p-4" data-buy-plot>
      <h2 className="font-display text-lg font-medium text-ink">Settle on the tree</h2>
      <p className="mt-1 text-sm text-ink/75">
        A plot costs {price} Hog coins; you have{" "}
        <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-ink">
          <HogCoin size={14} /> {balance}
        </span>
        . You start under the sky with a bedroll, and build from there. Pick a free plot on the ring, or take the next one.
      </p>
      {plots.length === 0 ? (
        <Skeleton className="mt-3 h-40" />
      ) : next === null ? (
        <p className="mt-3 text-sm text-ink">Every plot on the ring is taken. More come as the tree grows its rings.</p>
      ) : (
        <>
          <div className="mt-3">
            <PlotPicker taken={taken} picked={pick} onPick={setPicked} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" size="sm" disabled={busy || short > 0} onClick={() => void onBuy(next)} data-autofocus>
              Buy the next free plot
            </Button>
            {pick !== null && (
              <Button size="sm" disabled={busy || short > 0} onClick={() => void onBuy(pick)}>
                Buy plot {pick + 1}
              </Button>
            )}
          </div>
          {short > 0 && <p className="mt-2 text-sm text-ink/75">{short === 1 ? "1 more Hog coin" : `${short} more Hog coins`} and a plot is yours.</p>}
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-ember-deep">
          {error}
        </p>
      )}
    </Card>
  );
}

type Mine = NonNullable<ReturnType<typeof useQuery<typeof api.homes.mine>>>;

function YourHome({ home, balance }: { home: NonNullable<Mine["home"]>; balance: number | null }) {
  const build = useMutation(api.homes.build);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onBuild = async () => {
    setBusy(true);
    setError(null);
    try {
      await build({});
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const { next, building } = home;
  return (
    <Card className="flex flex-col gap-3 p-4 @sm:flex-row" data-your-home={home.stage}>
      <HomePicture stage={home.stage} building={!!building} label={`Your home: ${stageName(home.stage)}`} />
      <div className="min-w-0 flex-1 text-sm text-ink">
        <p className="font-display text-xl font-medium">{stageName(home.stage)}</p>
        <p className="text-ink/75">Plot {home.plot + 1} on the homes ring</p>
        {building && (
          <div className="mt-3" data-building>
            <p className="font-semibold">
              Building {theStage(building.to)}: {days(building.daysLeft)} left
            </p>
            <Progress
              className="mt-1"
              value={HOME_STAGE_BY_ID[building.to].days - building.daysLeft}
              max={HOME_STAGE_BY_ID[building.to].days}
              label={`${theStage(building.to)}, ${days(building.daysLeft)} left`}
            />
          </div>
        )}
        {next && (
          <div className="mt-3" data-next-stage={next.id}>
            <p>
              Next: {theStage(next.id)}, {days(next.days)} to build.{" "}
              {next.discounted !== null ? (
                <span className="font-semibold">
                  {next.discounted} Hog coins with your star fruit ({next.cost})
                </span>
              ) : (
                <span className="font-semibold">{next.cost} Hog coins</span>
              )}
              {balance !== null && <span className="text-ink/75">. You have {balance}.</span>}
            </p>
            <Button variant="primary" size="sm" className="mt-2" disabled={busy || (balance !== null && balance < (next.discounted ?? next.cost))} onClick={() => void onBuild()} data-autofocus>
              Build {theStage(next.id)}
            </Button>
          </div>
        )}
        {!next && !building && <p className="mt-3">The finest home on the tree. Nothing left to build.</p>}
        {error && (
          <p role="alert" className="mt-2 text-sm text-ember-deep">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}

function Neighbours({ homes, you }: { homes: HomeOnRing[]; you: string }) {
  const others = homes.filter((h) => h.memberId !== you);
  if (others.length === 0) return null;
  return (
    <Card className="p-4" data-neighbours>
      <h2 className="font-display text-lg font-medium text-ink">Neighbours</h2>
      <ul className="mt-2 grid gap-1.5 @sm:grid-cols-2">
        {others.map((h) => (
          <li key={h.memberId} className="flex min-w-0 items-center gap-2 text-sm">
            <House className="h-4 w-4 shrink-0 text-soil" aria-hidden />
            <Link to={`/homes/${h.memberId}`} className={clsx(linkCls, "whitespace-nowrap")}>
              {h.name}
            </Link>
            <span className="min-w-0 truncate text-ink/75">
              {stageName(h.stage)}
              {h.building ? ", building" : ""}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Your home's window, at the homes district's gate. */
export function Homes() {
  const viewer = useViewer();
  const now = useClockNow();
  const mine = useQuery(api.homes.mine, { now });
  const all = useQuery(api.homes.all, { now });
  if (mine === undefined || all === undefined) return <PageSkeleton />;
  if (mine === null) {
    return (
      <Empty icon={<House className="h-7 w-7 text-ink/70" />} title="Homes are part of the game">
        The game is off or hidden for you.
      </Empty>
    );
  }
  if (!mine.open) {
    return (
      <Empty icon={<House className="h-7 w-7 text-ink/70" />} title="No plots yet">
        The homes ring opens when the tree is a grown tree.
      </Empty>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {mine.home ? (
        <>
          <YourHome home={mine.home} balance={mine.balance} />
          <Guestbook lanterns={mine.home.guestbook} />
        </>
      ) : mine.balance === null || mine.level < mine.buyLevel ? (
        <Locked title="Your home on the tree" level={mine.buyLevel} how={`A plot costs ${mine.price} Hog coins, and your wallet opens at level ${mine.buyLevel}.`} />
      ) : (
        <BuyPlot price={mine.price} balance={mine.balance} taken={all} />
      )}
      <Neighbours homes={all} you={viewer.member._id} />
    </div>
  );
}

function LeaveLantern({ memberId }: { memberId: string }) {
  const leave = useMutation(api.homes.leaveLantern);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onLeave = async () => {
    setBusy(true);
    setError(null);
    try {
      await leave({ memberId: memberId as never, note });
      setNote("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void onLeave();
      }}
    >
      <label className="text-sm font-semibold text-ink" htmlFor="lantern-note">
        A note for their guestbook
      </label>
      <input id="lantern-note" name="note" className={inputCls} maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Thanks for the tea on Friday" />
      <div>
        <Button type="submit" variant="primary" size="sm" disabled={busy || note.trim().length === 0}>
          Leave a lantern
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-ember-deep">
          {error}
        </p>
      )}
    </form>
  );
}

/** A teammate's home, visited (your own shows your home's window). */
export function HomeOf() {
  const { memberId } = useParams();
  const viewer = useViewer();
  const now = useClockNow();
  const visit = useQuery(api.homes.of, memberId && memberId !== viewer.member._id ? { memberId, now } : "skip");
  if (memberId === viewer.member._id) return <Homes />;
  if (visit === undefined) return <PageSkeleton />;
  if (visit === null) {
    return (
      <Empty icon={<House className="h-7 w-7 text-ink/70" />} title="No home here">
        They haven't settled on the tree, or the game is off or hidden.{" "}
        <Link to="/homes" className={linkCls}>
          Your home
        </Link>
      </Empty>
    );
  }
  const banner = visit.look.banner ? cosmeticByKey(visit.look.banner) : undefined;
  return (
    <div className="flex flex-col gap-4">
      {/* Whose home: their frame and banner hang by the door (S5). */}
      <div data-owner className="pixel-chip relative overflow-hidden">
        {banner && <Art art={banner.art} className="h-16 w-full" />}
        <div className={clsx("relative flex items-end gap-3 px-4 pb-2", banner ? "-mt-7" : "pt-2")}>
          <FramedAvatar name={visit.name} src={visit.avatarUrl} size={48} look={visit.look} />
          <p className="truncate pb-1 font-display text-lg font-semibold text-ink [text-shadow:1px_0_0_var(--color-parchment),-1px_0_0_var(--color-parchment),0_1px_0_var(--color-parchment),0_-1px_0_var(--color-parchment)]">
            {visit.name}
          </p>
        </div>
      </div>
      <Card className="flex flex-col gap-3 p-4 @sm:flex-row" data-visit={visit.stage}>
        <HomePicture stage={visit.stage} building={!!visit.building} label={`${visit.name}'s home: ${stageName(visit.stage)}`} />
        <div className="min-w-0 flex-1 text-sm text-ink">
          <p className="font-display text-xl font-medium">{stageName(visit.stage)}</p>
          <p className="text-ink/75">Plot {visit.plot + 1} on the homes ring</p>
          {visit.building && (
            <p className="mt-2">
              Building {theStage(visit.building.to)}: {days(visit.building.daysLeft)} left
            </p>
          )}
          <div className="mt-3">
            {visit.canLeaveLantern ? <LeaveLantern memberId={visit.memberId} /> : <p className="text-ink/75">You left a lantern here this week. Come back next week for another.</p>}
          </div>
        </div>
      </Card>
      <Guestbook lanterns={visit.guestbook} />
      <p className="text-sm">
        <Link to={`/garden/${visit.memberId}`} className={linkCls}>
          Visit their garden
        </Link>
      </p>
    </div>
  );
}

/** The canopy district's window: the tree from above at night, every home on the ring lit. */
export function Canopy() {
  const { plots, seed } = useHomeRing();
  const all = useQuery(api.homes.all, { now: useClockNow() });
  // The homes the ring draws: none on a plot a district covers.
  const lit = useMemo(() => ringHomes(plots, all ?? []), [plots, all]);
  const scene = useMemo(() => canopyScene(plots, lit, seed), [plots, lit, seed]);
  if (all === undefined) return <PageSkeleton />;
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-dusk-deep p-2">
        <PixelArt map={scene} label={`The tree from above at night, ${lit.length} homes lit`} className="mx-auto w-full max-w-md" />
      </div>
      <p className="text-sm text-ink">
        {lit.length === 1 ? "1 home lit" : `${lit.length} homes lit`} on the ring tonight. Every thoughtful kudos grew the branches they stand on.
      </p>
    </div>
  );
}
