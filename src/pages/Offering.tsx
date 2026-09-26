import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { motion, useReducedMotionConfig } from "motion/react";
import { useMemo, useRef, useState, type RefObject } from "react";
import { api } from "../../convex/_generated/api";
import { FRUIT_BY_ID, FRUIT_PER_COINS, type FruitId } from "../../convex/lib/fruits";
import type { TreeStageId } from "../../convex/lib/tree";
import { HogCoin } from "@/components/HogCoin";
import { Button, Card, Empty, PageSkeleton } from "@/components/ui";
import { CoinsToWallet } from "@/world/CoinsToWallet";
import { offeringStone } from "@/world/places/offering";
import { pixelRuns, type PixelMap } from "@/world/pixels";
import { treeSprite } from "@/world/tree/sprite";
import { FruitArt } from "@/world/FruitArt";

/**
 * The offering stone's window (#157; plan #152 S3 and its seeds amendment): the tree's two rituals.
 *
 * - **Offer your appreciation**: the Hog coins your thoughtful kudos left waiting drop from the canopy
 *   into your wallet, the tree glows once with the fuel, and the fruit it drops is revealed one by
 *   one in a parchment ledger (`api.offerings.claim`).
 * - **Plant your seeds**: the seeds teammates sowed when they thanked you sink into the roots and the
 *   tree glows once (`api.tree.plantSeeds`).
 *
 * Each animation plays once, for the press that started it; under reduced motion only the words come.
 */

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const errorText = (e: unknown) => (e instanceof ConvexError ? String(e.data) : "Something went wrong. Try again.");

/** A pixel map as crisp SVG, scaled to fit its box. */
function Pixels({ map, className, label }: { map: PixelMap; className?: string; label?: string }) {
  const runs = useMemo(() => pixelRuns(map), [map]);
  const w = map.rows[0]?.length ?? 0;
  return (
    <svg viewBox={`0 0 ${w} ${map.rows.length}`} shapeRendering="crispEdges" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {runs.map((p) => (
        <rect key={`${p.x},${p.y}`} x={p.x} y={p.y} width={p.w} height={1} fill={p.fill} />
      ))}
    </svg>
  );
}

type Moment = { id: number; kind: "claim" | "plant"; seeds: number };

/** The tree over the stone: where the coins fall from and the seeds sink to, and where the sap glows. */
function Scene({ stage, worldSeed, rings, planted, moment, canopy }: { stage: TreeStageId; worldSeed: number; rings: number; planted: boolean; moment: Moment | null; canopy: RefObject<HTMLDivElement | null> }) {
  const still = useReducedMotionConfig();
  const tree = useMemo(() => (planted ? treeSprite(stage, worldSeed, rings) : null), [planted, stage, worldSeed, rings]);
  const stone = useMemo(() => offeringStone(), []);
  return (
    <div data-offering-scene className="relative h-56 overflow-hidden bg-dusk shadow-[inset_0_-24px_0_0_var(--color-sand-deep)]">
      <div className="absolute inset-x-0 bottom-6 h-10 bg-sand" />
      {tree ? (
        <Pixels map={tree} className="absolute bottom-6 left-1/2 h-52 max-w-[90%] -translate-x-[60%]" label="The Ancient Tree" />
      ) : (
        <p className="absolute inset-x-0 top-6 text-center text-sm text-cream/80">The desert waits for its first seed.</p>
      )}
      <Pixels map={stone} className="absolute bottom-2 left-[62%] h-28" label="The offering stone" />
      {/* Where the coins fall from: the canopy's middle. */}
      <div ref={canopy} aria-hidden className="absolute left-[40%] top-6 h-28 w-2" />
      {moment && !still && (
        <motion.div
          key={`burst-${moment.id}`}
          data-sap-burst
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_40%_45%,var(--color-sap)_0%,transparent_60%)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.75, 0] }}
          transition={{ duration: 1.4, delay: moment.kind === "claim" ? 0.3 : 0.8, ease: "easeOut" }}
        />
      )}
      {moment?.kind === "plant" &&
        !still &&
        Array.from({ length: Math.min(8, moment.seeds) }, (_, i) => (
          <motion.span
            key={`seed-${moment.id}-${i}`}
            data-seed-sink
            aria-hidden
            className="absolute block h-3 w-2 bg-soil shadow-[0_0_0_1px_var(--color-dusk-deep)]"
            style={{ left: `${36 + i * 3}%`, top: "8%" }}
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: [0, 150, 180], opacity: [1, 1, 0] }}
            transition={{ duration: 1.6, delay: i * 0.12, ease: "easeIn", times: [0, 0.75, 1] }}
          />
        ))}
    </div>
  );
}

type Claimed = { coins: number | null; fuel: number; fruit: FruitId[]; more: boolean };

/** What a claim brought, line by line: the coins, then each fruit, revealed one after another. */
function Ledger({ claimed }: { claimed: Claimed }) {
  const still = useReducedMotionConfig();
  // Each line opens up in turn, so the ledger grows as the fruit comes, never an empty page waiting.
  const reveal = (i: number) =>
    still ? {} : { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: "auto" }, transition: { delay: 0.6 + i * 0.3, duration: 0.2 } };
  return (
    <ol data-ledger className="mt-3 border-2 border-bark bg-parchment px-3 pt-3 pb-1 text-sm text-ink shadow-[3px_3px_0_0_var(--color-dusk-deep)] [&>li]:overflow-hidden [&>li]:pb-2">
      <motion.li {...reveal(0)} className="flex items-center gap-2 font-semibold">
        <HogCoin size={16} />
        {claimed.coins === null ? "Your coins went into your wallet." : `${plural(claimed.coins, "Hog coin", "Hog coins")} into your wallet.`}
      </motion.li>
      <motion.li {...reveal(1)} className="text-ink/75">
        The tree took {plural(claimed.fuel, "fuel", "fuel")} from your offering and grew.
      </motion.li>
      {claimed.fruit.map((id, i) => (
        <motion.li key={i} {...reveal(i + 2)} data-fruit={id} className="flex items-start gap-2">
          <FruitArt fruit={id} size={24} />
          <span>
            <span className="font-semibold">{FRUIT_BY_ID[id].name}</span>. {FRUIT_BY_ID[id].about}
          </span>
        </motion.li>
      ))}
      {claimed.fruit.length === 0 && (
        <motion.li {...reveal(2)} className="text-ink/75">
          A fruit drops for every {FRUIT_PER_COINS} Hog coins you offer, over all your offerings.
        </motion.li>
      )}
      {claimed.more && <li className="text-ink/75">More appreciation waits: offer it again.</li>}
    </ol>
  );
}

function Claim({ pending, onMoment, canopy }: { pending: { coins: number | null; offerings: number }; onMoment: (kind: "claim") => void; canopy: RefObject<HTMLDivElement | null> }) {
  const claim = useMutation(api.offerings.claim);
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState<Claimed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: number; count: number } | null>(null);
  const waiting = pending.offerings > 0;
  const onClaim = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await claim({});
      setClaimed(r);
      onMoment("claim");
      if (r.coins) setDrop({ id: Date.now(), count: Math.min(8, r.coins) });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const title =
    claimed && !waiting
      ? "You offered your appreciation"
      : !waiting
        ? "Nothing waiting at the stone"
        : pending.coins === null
          ? "Your appreciation is waiting"
          : `${plural(pending.coins, "Hog coin", "Hog coins")} waiting for you`;
  return (
    <Card className="p-4" data-ritual="claim">
      <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink/75">
        {waiting
          ? "Your thoughtful kudos left them here. Offer your appreciation: the coins go into your wallet, the tree grows with it, and now and then it drops a fruit."
          : claimed
            ? "The tree took it in. Here is what it gave back."
            : "Give a thoughtful kudos, a few words on why, and its Hog coins wait here for you to offer."}
      </p>
      {waiting && (
        <Button variant="primary" size="sm" className="mt-3" disabled={busy} onClick={() => void onClaim()} data-autofocus>
          Offer your appreciation
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-ember-deep">
          {error}
        </p>
      )}
      {claimed && <Ledger claimed={claimed} />}
      {drop && canopy.current && <CoinsToWallet key={drop.id} from={canopy.current} count={drop.count} arc="drop" onDone={() => setDrop(null)} />}
    </Card>
  );
}

function Plant({ seeds, any, onMoment }: { seeds: number | null; any: boolean; onMoment: (kind: "plant", seeds: number) => void }) {
  const plantSeeds = useMutation(api.tree.plantSeeds);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const onPlant = async () => {
    setBusy(true);
    try {
      const r = await plantSeeds({});
      onMoment("plant", r.planted ?? seeds ?? 3);
      const more = r.more ? " More seeds wait: plant again." : "";
      setSaid(r.planted === null ? `You planted your seeds. The tree grew.${more}` : `You planted ${plural(r.planted, "seed", "seeds")}. The tree grew.${more}`);
    } catch (e) {
      setSaid(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const title = said && !any ? "You planted your seeds" : !any ? "No seeds to plant" : seeds === null ? "Seeds to plant" : `${plural(seeds, "seed", "seeds")} to plant`;
  return (
    <Card className="p-4" data-ritual="plant">
      <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink/75">
        {any
          ? "Teammates thanked you thoughtfully, and each thanks sowed a seed. Plant them in the roots and the tree grows with them."
          : said
            ? "They sank into the roots."
            : "When a teammate thanks you thoughtfully, their seed waits here for you to plant. Seeds nobody plants in 30 days plant themselves."}
      </p>
      {any && (
        <Button variant="primary" size="sm" className="mt-3" disabled={busy} onClick={() => void onPlant()}>
          Plant your seeds
        </Button>
      )}
      {said && (
        <p role="status" className="mt-2 text-sm text-soil">
          {said}
        </p>
      )}
    </Card>
  );
}

export function Offering() {
  const pending = useQuery(api.offerings.pending, {});
  const tree = useQuery(api.tree.state, {});
  const canopy = useRef<HTMLDivElement>(null);
  const [moment, setMoment] = useState<Moment | null>(null);
  if (pending === undefined || tree === undefined) return <PageSkeleton />;
  if (pending === null || tree === null) {
    return <Empty title="The offering stone is part of the game">Switch the game on, or show it again on your Me page, to offer your appreciation and plant your seeds.</Empty>;
  }
  const play = (kind: Moment["kind"], seeds = 0) => setMoment((m) => ({ id: (m?.id ?? 0) + 1, kind, seeds }));
  return (
    <div className="space-y-4">
      <Scene stage={tree.stage} worldSeed={tree.worldSeed} rings={tree.rings} planted={tree.planted} moment={moment} canopy={canopy} />
      <Claim pending={pending} onMoment={play} canopy={canopy} />
      <Plant seeds={tree.seedsToPlant} any={tree.hasSeedsToPlant} onMoment={play} />
    </div>
  );
}

