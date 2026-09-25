import clsx from "clsx";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Lamp, Sprout, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { LANTERN, STAGES, type StageKey } from "../../convex/lib/garden";
import { Locked } from "@/components/game";
import { EmptyBedArt, PlantArt } from "@/components/PlantArt";
import { HogCoin } from "@/components/HogCoin";
import { RemoteArt } from "@/components/RemoteArt";
import { Avatar, Button, Card, CardHeader, Dialog, Empty, PageSkeleton } from "@/components/ui";
import { useWorkspaceToday } from "@/lib/period";
import { FRUIT_PICKED, plotCount, plotFrom } from "@/world/gardenWorld";

type Mine = NonNullable<ReturnType<typeof useQuery<typeof api.gardens.mine>>>;
type OpenGarden = Extract<Mine, { open: true }>;
type Grown = OpenGarden["plants"][number];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const coins = (n: number) => plural(n, "Hog coin", "Hog coins");
/** A memory keeps its stage by name: draw it at that stage (a Seed if the name is unknown). */
const stageKeyOf = (name: string): StageKey => STAGES.find((s) => s.name === name)?.key ?? "seed";
const errorText = (e: unknown) => (e instanceof ConvexError ? String(e.data) : "Something went wrong. Try again.");
const linkCls = "font-semibold text-ember-deep underline decoration-2 underline-offset-4";

/**
 * Your garden's window (#55 §G8, #129): your key beds are on the map, in the middle of the world;
 * here is the whole garden at a glance (plots, coins, the harvest, the plants grown for you and the
 * memories), and `/garden?plot=N` is the window of one plot: its plant and what it needs, or the
 * teammates you can plant for. Walking onto a key bed on the map opens its plot window. The garden
 * opens at level 3 with one plot; the Gardener skills add plots, early growth and the plant picker.
 */
export function Garden() {
  const today = useWorkspaceToday();
  const [params] = useSearchParams();
  const game = useQuery(api.game.mine, {});
  const mine = useQuery(api.gardens.mine, { today });
  const forMe = useQuery(api.gardens.forMe, { today });
  if (mine === undefined || game === undefined) return <PageSkeleton />;

  if (mine === null) {
    const [title, body] = !game.enabled
      ? ["The game is off in this workspace", "An admin can switch the game on in the settings. Your kudos work as always."]
      : ["The game is hidden", "You hid the game, so your garden is out of view. Show the game in your cabin to see it again."];
    return (
      <Empty icon={<Sprout className="h-7 w-7 text-ink/70" />} title={title}>
        {body}{" "}
        <Link to="/me" className={linkCls}>
          Your cabin
        </Link>
      </Empty>
    );
  }
  const plot = mine.open ? plotFrom(`?${params}`, plotCount(mine)) : null;
  if (mine.open && plot !== null) return <PlotWindow garden={mine} plot={plot} sunlamps={game.sunlamps ?? 0} />;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-ink/75">
          Grow a plant for a teammate you recognise. It grows each week you thank them with a few words on why, and it never dies.
        </p>
        {mine.open && <GardenScene />}
      </div>
      {mine.open ? (
        <OwnGarden garden={mine} />
      ) : (
        <div className="flex flex-col gap-2">
          <Locked title="Your garden" level={mine.opensAt} how="At level 3 you can grow a plant for a teammate you recognise. Thoughtful kudos get you there." />
          <p className="text-xs text-ink/75">Until then the lawn in the middle of the world stays fenced off.</p>
        </div>
      )}
      <GrownForYou plants={forMe ?? []} />
      {mine.open && <Memories memories={mine.memories} />}
    </div>
  );
}

/**
 * posthog.com's Keyboard garden (#101): its key beds and gardening hedgehogs, PostHog's art from
 * PostHog's servers. A fixed box, so the window never moves while it loads; nothing if it can't.
 */
function GardenScene() {
  return <RemoteArt slot="garden-scene" fit="contain" className="h-24 w-24 shrink-0 @sm:h-32 @sm:w-32" />;
}

function OwnGarden({ garden }: { garden: OpenGarden }) {
  const shown = plotCount(garden);
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm text-ink">
        <span>
          {plural(garden.plants.length, "plant", "plants")} in {plural(garden.plots, "plot", "plots")}
          {garden.plants.length > garden.plots && " (uproot one to plant again)"}
        </span>
        <span className="inline-flex items-center gap-1.5 tabular">
          <HogCoin size={16} />
          {coins(garden.balance)}
        </span>
      </div>
      <Harvest garden={garden} />
      <section aria-labelledby="your-plots">
        <h3 id="your-plots" className="mb-2 font-display text-lg font-medium text-ink">
          Your plots
        </h3>
        <ul className="grid gap-2 @sm:grid-cols-2">
          {Array.from({ length: shown }, (_, i) => {
            const p = garden.plants.find((g) => g.plot === i);
            return p ? <PlotRow key={p.plantId} plant={p} index={i} /> : <EmptyRow key={`empty-${i}`} index={i} canPlant={garden.candidates.length > 0} />;
          })}
        </ul>
      </section>
    </>
  );
}

function PlotRow({ plant, index }: { plant: Grown; index: number }) {
  return (
    <li data-plot data-plant={plant.plantId} data-dormant={plant.dormant ? "true" : "false"}>
      <Link to={`/garden?plot=${index}`} className="flex items-center gap-3 border-2 border-bark/60 bg-parchment-deep/40 p-2 text-ink hover:bg-parchment-deep">
        <PlantArt stage={plant.stage as StageKey} species={plant.species} dormant={plant.dormant} fruit={plant.fruit.length} goldenLeaves={plant.goldenLeaves} size={64} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{plant.speciesName}</span>
          <span className="block truncate text-xs text-ink/75">for {plant.forName}</span>
          <span className="mt-1 flex flex-wrap gap-1 text-xs">
            <span className="border border-bark/60 px-1.5">{plant.stageName}</span>
            {plant.dormant && <span className="bg-soil/20 px-1.5 text-soil">Dormant</span>}
            {plant.fruit.length > 0 && <span className="bg-lantern/25 px-1.5 text-soil">{plural(plant.fruit.length, "fruit", "fruit")}</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}

function EmptyRow({ index, canPlant }: { index: number; canPlant: boolean }) {
  return (
    <li data-plot>
      <Link to={`/garden?plot=${index}`} className="flex items-center gap-3 border-2 border-dashed border-bark/60 p-2 text-ink hover:bg-parchment-deep/60">
        <EmptyBedArt size={64} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Empty plot</span>
          <span className="block text-xs text-soil underline underline-offset-4">{canPlant ? "Plant here" : "Open plot"}</span>
        </span>
      </Link>
    </li>
  );
}

function stageLine(plant: Pick<Grown, "waterings" | "awakeDays" | "next">) {
  if (!plant.next) return "The oldest a plant grows.";
  const { next } = plant;
  return `${plant.waterings} of ${next.waterings} waterings, ${Math.min(plant.awakeDays, next.days)} of ${next.days} days to ${next.name}`;
}

/** One key bed's window: its plant and what it needs, or the teammates you can plant for there. */
function PlotWindow({ garden, plot, sunlamps }: { garden: OpenGarden; plot: number; sunlamps: number }) {
  const plant = garden.plants.find((p) => p.plot === plot);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        <Link to="/garden" className={linkCls}>
          All of your garden
        </Link>
      </p>
      {plant ? <PlotPlant plant={plant} sunlamps={sunlamps} /> : <EmptyPlot garden={garden} />}
    </div>
  );
}

function PlotPlant({ plant, sunlamps }: { plant: Grown; sunlamps: number }) {
  const applySunlamp = useMutation(api.gardens.useSunlamp);
  const takeDown = useMutation(api.gardens.takeDownLantern);
  const [uprooting, setUprooting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (p: Promise<unknown>) => {
    setError(null);
    p.catch((e) => setError(errorText(e)));
  };
  const lampLabel = `Use a Sunlamp on ${plant.speciesName} for ${plant.forName} (${sunlamps} left)`;
  const fruit = plant.fruit.length;
  return (
    <div data-plant={plant.plantId} data-dormant={plant.dormant ? "true" : "false"} className="flex flex-col gap-4 @sm:flex-row @sm:items-start">
      <div className="self-center bg-dusk p-2 @sm:self-start">
        <PlantArt stage={plant.stage as StageKey} species={plant.species} dormant={plant.dormant} fruit={fruit} goldenLeaves={plant.goldenLeaves} size={128} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm text-ink">
        <div>
          <h3 className="font-display text-2xl font-medium">{plant.speciesName}</h3>
          <p className="text-ink/75">for {plant.forName}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="border border-bark/60 px-2 py-0.5">{plant.stageName}</span>
          {plant.dormant && <span className="bg-soil/20 px-2 py-0.5 text-soil">Dormant</span>}
          {fruit > 0 && <span className="bg-lantern/25 px-2 py-0.5 text-soil">{plural(fruit, "fruit", "fruit")} waiting</span>}
          {plant.goldenLeaves > 0 && (
            // A golden leaf per Super kudos you sent them (#98), drawn on the plant too.
            <span data-art-slot="golden-leaf" className="bg-lantern/25 px-2 py-0.5 text-soil">
              {plural(plant.goldenLeaves, "golden leaf", "golden leaves")}
            </span>
          )}
        </div>
        <p className="text-ink/75">{stageLine(plant)}</p>
        {plant.dormant && <p>Dormant: thank {plant.forName} with a few words on why to wake it.</p>}
        {fruit > 0 && (
          <p className="text-ink/75">
            Pick it from{" "}
            <Link to="/garden" className={linkCls}>
              all of your garden
            </Link>
            .
          </p>
        )}
        {plant.lantern && (
          <p className="flex items-start gap-1.5 bg-lantern/20 px-2 py-1.5 text-xs">
            <Lamp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-soil" aria-hidden />
            <span className="min-w-0 flex-1 break-words">
              Lantern from {plant.lantern.by}: “{plant.lantern.note}”
            </span>
            <button
              type="button"
              aria-label={`Take down ${plant.lantern.by}'s lantern`}
              title="Take it down"
              onClick={() => run(takeDown({ plantId: plant.plantId }))}
              className="shrink-0 p-0.5 text-ink/75 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-2">
          {plant.sunlamp && sunlamps > 0 && (
            <Button size="sm" variant="primary" aria-label={lampLabel} title={lampLabel} onClick={() => run(applySunlamp({ plantId: plant.plantId }))}>
              Use a Sunlamp: 5 days sooner
            </Button>
          )}
          <Button size="sm" onClick={() => setUprooting(true)}>
            Uproot
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-ember-deep">
            {error}
          </p>
        )}
      </div>
      <UprootDialog plant={uprooting ? plant : null} onClose={() => setUprooting(false)} />
    </div>
  );
}

/** An empty key bed: plant for a teammate you thanked this week, or how to get there. */
function EmptyPlot({ garden }: { garden: OpenGarden }) {
  return (
    <div data-plot className="flex flex-col gap-4 @sm:flex-row @sm:items-start">
      <div className="relative self-center bg-dusk p-2 @sm:self-start">
        <EmptyBedArt size={128} />
        {/* A gardening hoggie waits by the plot: PostHog's art, nothing if it can't load. */}
        <RemoteArt slot="hoggie-empty-plot" fit="contain" className="absolute bottom-1 right-1 h-12 w-12" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="mb-2 font-display text-2xl font-medium text-ink">Empty plot</h3>
        {garden.candidates.length > 0 ? (
          <PlantForm garden={garden} />
        ) : (
          <p className="text-sm text-ink/75">Thank a teammate in Slack with a few words on why. For 7 days after, you can plant for them here.</p>
        )}
      </div>
    </div>
  );
}

function PlantForm({ garden }: { garden: OpenGarden }) {
  const plant = useMutation(api.gardens.plant);
  const [teammate, setTeammate] = useState<Id<"members"> | null>(null);
  const [species, setSpecies] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const short = garden.balance < garden.cost;
  const chosen = garden.candidates.find((c) => c.memberId === teammate);
  const submit = async () => {
    if (!teammate) return;
    setBusy(true);
    setError(null);
    try {
      await plant({ teammateId: teammate, ...(species ? { species } : {}) });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3 text-sm text-ink">
      <p className="text-ink/75">
        A plant costs {coins(garden.cost)}; you have {garden.balance}. Only they will see it's for them. Teammates you thanked thoughtfully in the last 7 days:
      </p>
      <ul className="grid gap-2 @sm:grid-cols-2">
        {garden.candidates.map((c) => (
          <li key={c.memberId}>
            <button
              type="button"
              data-candidate={c.memberId}
              aria-pressed={teammate === c.memberId}
              onClick={() => setTeammate(c.memberId)}
              className={clsx(
                "flex w-full items-center gap-2 border-2 px-3 py-2 text-left",
                teammate === c.memberId ? "border-bark bg-lantern/30" : "border-bark/60 hover:bg-parchment-deep/60",
              )}
            >
              <Avatar name={c.name} src={c.avatarUrl} size={24} />
              <span className="truncate">{c.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {garden.species.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="text-ink/75">Species (your plant picker)</span>
          <select value={species} onChange={(e) => setSpecies(e.target.value)} className="h-10 border-2 border-bark/60 bg-parchment-deep/40 px-3 text-ink">
            <option value="">Pick one for me</option>
            {garden.species.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.rare ? " (rare)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {short && <p className="text-xs text-ink/75">Thoughtful kudos earn Hog coins: you need {garden.cost - garden.balance} more.</p>}
      <div>
        <Button variant="primary" disabled={!chosen || busy || short} onClick={() => void submit()}>
          {chosen ? `Plant for ${chosen.name}` : "Pick a teammate"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-ember-deep">
          {error}
        </p>
      )}
    </div>
  );
}

function Harvest({ garden }: { garden: OpenGarden }) {
  const pick = useMutation(api.gardens.pick);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hop, setHop] = useState<{ from: HTMLElement; count: number; id: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const fruit = garden.plants.flatMap((p) => p.fruit);
  const worth = fruit.reduce((s, f) => s + f.coins, 0);
  const { harvest } = garden;
  if (garden.plants.length === 0) return null;
  const onPick = async () => {
    setBusy(true);
    try {
      const r = await pick({});
      setResult(r.fruit === 0 ? "This week's fruit is all in: the rest waits on your plants." : `Picked ${plural(r.fruit, "fruit", "fruit")}: +${coins(r.coins)}, +${r.xp} XP.`);
      if (r.fruit > 0) {
        window.dispatchEvent(new Event(FRUIT_PICKED));
        if (button.current) setHop({ from: button.current, count: Math.min(r.fruit, 8), id: Date.now() });
      }
    } catch (e) {
      setResult(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1 text-sm text-ink">
        <div className="font-semibold">{fruit.length > 0 ? `${plural(fruit.length, "fruit", "fruit")} waiting, worth ${coins(worth)}` : "No fruit waiting"}</div>
        <div className="text-xs text-ink/75">
          A Grown plant fruits every day while you've thanked its teammate in the last 14 days, and holds {harvest.hold}. This week from fruit: {harvest.weekCoins} of{" "}
          {harvest.capCoins} Hog coins and {harvest.weekXp} of {harvest.capXp} XP.
        </div>
        {result && (
          <div role="status" className="mt-1 text-xs text-soil">
            {result}
          </div>
        )}
      </div>
      <Button ref={button} variant="primary" size="sm" disabled={fruit.length === 0 || busy} onClick={() => void onPick()}>
        {fruit.length > 0 ? `Pick ${plural(fruit.length, "fruit", "fruit")}` : "Pick fruit"}
      </Button>
      {hop && <FruitHop key={hop.id} from={hop.from} count={hop.count} onDone={() => setHop(null)} />}
    </Card>
  );
}

/** How long the picked fruit takes to hop to your coins. */
const HOP_MS = 900;

/**
 * Picked fruit hops from the Pick button to the Hog coins in the corner (#129): a few gold pixels,
 * once, then gone. Nothing under reduced motion.
 */
function FruitHop({ from, count, onDone }: { from: HTMLElement; count: number; onDone: () => void }) {
  const still = useReducedMotion();
  const layer = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  useLayoutEffect(() => {
    // Measured against the layer itself: inside a window, `fixed` may be relative to the window.
    const origin = layer.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const a = from.getBoundingClientRect();
    const start = { x: a.left + a.width / 2, y: a.top };
    const coinsAt = document.querySelector("[data-hud-coins]")?.getBoundingClientRect();
    const end = coinsAt && coinsAt.width > 0 ? { x: coinsAt.left + 8, y: coinsAt.top + 8 } : { x: start.x, y: -24 };
    setPath({ x: start.x - origin.left, y: start.y - origin.top, dx: end.x - start.x, dy: end.y - start.y });
    const timer = setTimeout(onDone, HOP_MS + count * 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from]);
  if (still) return null;
  return (
    <div ref={layer} aria-hidden className="pointer-events-none fixed left-0 top-0 z-50 h-0 w-0">
      {path &&
        Array.from({ length: count }, (_, i) => (
          <motion.span
            key={i}
            data-fruit-hop
            className="absolute h-2 w-2 bg-lantern shadow-[2px_2px_0_var(--color-dusk-deep)]"
            style={{ left: path.x + (i - (count - 1) / 2) * 10, top: path.y }}
            initial={{ x: 0, y: 0 }}
            animate={{ x: path.dx - (i - (count - 1) / 2) * 10, y: [0, -32, path.dy] }}
            transition={{ duration: HOP_MS / 1000, delay: i * 0.06, ease: "easeOut" }}
          />
        ))}
    </div>
  );
}

function UprootDialog({ plant, onClose }: { plant: Grown | null; onClose: () => void }) {
  const uproot = useMutation(api.gardens.uproot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setError(null);
    onClose();
  };
  const confirm = async () => {
    if (!plant) return;
    setBusy(true);
    setError(null);
    try {
      await uproot({ plantId: plant.plantId });
      close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={plant !== null}
      onClose={close}
      title={plant ? `Uproot the ${plant.speciesName} for ${plant.forName}?` : "Uproot"}
      subtitle="Its plot is free again, and the plant stays with your memories. The Hog coins it cost don't come back."
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={close}>Keep it</Button>
          <Button data-confirm variant="danger" disabled={busy} onClick={() => void confirm()}>
            Uproot
          </Button>
        </div>
      }
    >
      <div className="px-5 py-3">
        {error && (
          <p role="alert" className="text-sm text-ember-deep">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

type ForMe = NonNullable<ReturnType<typeof useQuery<typeof api.gardens.forMe>>>;

function GrownForYou({ plants }: { plants: ForMe }) {
  const takeDown = useMutation(api.gardens.takeDownLantern);
  if (plants.length === 0) return null;
  return (
    <Card>
      <CardHeader title="Grown for you" subtitle="Only you can see these plants are yours." />
      <ul className="px-5 pb-5">
        {plants.map((p) => (
          <li key={p.plantId} className="flex items-center gap-3 border-t border-parchment-deep py-2.5 first:border-t-0">
            <PlantArt stage={p.stage as StageKey} species={p.species} dormant={p.dormant} goldenLeaves={p.goldenLeaves} size={64} />
            <div className="min-w-0 flex-1 text-sm text-ink">
              <div>
                {p.ownerName} is growing a {p.speciesName} for you
              </div>
              <div className="text-xs text-ink/75">
                {p.dormant ? `${p.stageName}, dormant for now` : p.stageName}
                {p.goldenLeaves > 0 && <span className="text-soil">, with {plural(p.goldenLeaves, "golden leaf", "golden leaves")} from {p.ownerName}'s Super kudos</span>}
              </div>
              {p.lantern && (
                <div className="text-xs">
                  Lantern from {p.lantern.by}: “{p.lantern.note}”{" "}
                  <button type="button" className="text-ink/75 underline underline-offset-4 hover:text-ink" onClick={() => void takeDown({ plantId: p.plantId }).catch(() => {})}>
                    Take it down
                  </button>
                </div>
              )}
              <Link to={`/garden/${p.ownerId}`} className={clsx(linkCls, "text-xs")}>
                Visit {p.ownerName}'s garden
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Plants you uprooted, and plants grown for teammates who left: small sprites on a shelf. */
function Memories({ memories }: { memories: OpenGarden["memories"] }) {
  if (memories.length === 0) return null;
  return (
    <section aria-labelledby="memories">
      <h3 id="memories" className="font-display text-lg font-medium text-ink">
        Memories
      </h3>
      <p className="mb-2 text-xs text-ink/75">Plants you uprooted, and plants grown for teammates who left.</p>
      <ul data-memories className="grid grid-cols-2 gap-x-2 gap-y-3 border-b-4 border-bark pb-2 @sm:grid-cols-3">
        {memories.map((m) => (
          <li key={m.plantId} className="flex min-w-0 flex-col items-center text-center text-xs text-ink">
            {/* A memory is the plant as it was, a little faded. */}
            <span className="opacity-70">
              <PlantArt stage={stageKeyOf(m.stageName)} species={m.species} size={64} />
            </span>
            <span className="w-full truncate font-semibold">
              {m.speciesName} for {m.forName}
            </span>
            <span className="w-full truncate text-ink/75">
              {m.stageName}, {m.reason === "left" ? "they left" : `uprooted ${m.memoryDay}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A teammate's garden: the plants, never whom they're for, except the one grown for you. */
export function GardenOf() {
  const { memberId } = useParams();
  const garden = useQuery(api.gardens.of, memberId ? { memberId: memberId as Id<"members"> } : "skip");
  const lanterns = useQuery(api.game.mine, {})?.lanterns ?? 0;
  const takeDown = useMutation(api.gardens.takeDownLantern);
  if (garden === undefined) return <PageSkeleton />;
  if (garden === null) {
    return (
      <Empty icon={<Sprout className="h-7 w-7 text-ink/70" />} title="This garden isn't here">
        It may belong to someone who left, or the game is off or hidden.{" "}
        <Link to="/garden" className={linkCls}>
          Your garden
        </Link>
      </Empty>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-display text-2xl font-medium text-ink">{garden.name}'s garden</h3>
        <p className="text-sm text-ink/75">Every plant here is for a teammate. Only they know which one is theirs.</p>
      </div>
      {garden.plants.length === 0 ? (
        <Empty icon={<Sprout className="h-7 w-7 text-ink/70" />} title="Nothing planted yet" />
      ) : (
        <div className="grid gap-3 @lg:grid-cols-2">
          {garden.plants.map((p) => (
            <PlantFace
              key={p.plantId}
              plant={p}
              forYou={p.forYou}
              // Not on a plant grown for you: a lantern from you would tell everyone it's yours.
              footer={!p.lantern && !p.forYou && lanterns > 0 && <LanternForm plantId={p.plantId} lanterns={lanterns} />}
              onTakeDownLantern={p.canTakeDown ? () => void takeDown({ plantId: p.plantId }).catch(() => {}) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type TheirPlant = NonNullable<ReturnType<typeof useQuery<typeof api.gardens.of>>>["plants"][number];

/** One plant in a teammate's garden. */
function PlantFace({ plant, forYou, footer, onTakeDownLantern }: { plant: TheirPlant; forYou: boolean; footer?: React.ReactNode; onTakeDownLantern?: () => void }) {
  return (
    <Card data-plot data-plant={plant.plantId} data-dormant={plant.dormant ? "true" : "false"} className={clsx("flex gap-3 p-3", forYou && "bg-lantern/20")}>
      <PlantArt stage={plant.stage as StageKey} species={plant.species} dormant={plant.dormant} size={64} />
      <div className="min-w-0 flex-1 text-sm text-ink">
        <div className="truncate font-semibold">{plant.speciesName}</div>
        {forYou && <div className="text-xs font-semibold text-soil">Growing for you</div>}
        <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
          <span className="border border-bark/60 px-2 py-0.5">{plant.stageName}</span>
          {plant.dormant && <span className="bg-soil/20 px-2 py-0.5 text-soil">Dormant</span>}
        </div>
        {plant.lantern && (
          <p className="mt-2 flex items-start gap-1.5 bg-lantern/20 px-2 py-1.5 text-xs">
            <Lamp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-soil" aria-hidden />
            <span className="min-w-0 flex-1 break-words">
              Lantern from {plant.lantern.by}: “{plant.lantern.note}”
            </span>
            {onTakeDownLantern && (
              <button type="button" aria-label={`Take down ${plant.lantern.by}'s lantern`} title="Take it down" onClick={onTakeDownLantern} className="shrink-0 p-0.5 text-ink/75 hover:text-ink">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </p>
        )}
        {footer}
      </div>
    </Card>
  );
}

/** Hangs one of the viewer's Lanterns (#97) on a teammate's plant: a one-line note for 7 days. */
function LanternForm({ plantId, lanterns }: { plantId: Id<"plants">; lanterns: number }) {
  const hang = useMutation(api.gardens.hangLantern);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <Button size="sm" className="mt-2" onClick={() => setOpen(true)} title={`${lanterns} left`}>
        <Lamp className="h-3.5 w-3.5" aria-hidden />
        Hang a Lantern
      </Button>
    );
  }
  const submit = () => {
    setError(null);
    hang({ plantId, note })
      .then(() => setOpen(false))
      .catch((e) => setError(errorText(e)));
  };
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <input
        aria-label="Lantern note"
        className="h-8 w-full border-2 border-bark/60 bg-parchment-deep/40 px-2 text-xs text-ink"
        maxLength={LANTERN.maxChars}
        placeholder="One line for everyone who sees this plant"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" onClick={submit} disabled={note.trim().length === 0}>
          Hang it
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Not now
        </Button>
        <span className="ml-auto text-xs text-ink/75">Glows for {LANTERN.days} days</span>
      </div>
      {error && <p className="text-xs text-ember-deep">{error}</p>}
    </div>
  );
}
