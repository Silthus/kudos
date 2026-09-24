import clsx from "clsx";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Apple, Flower2, Lamp, Shovel, Sprout, Sun, X } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { LANTERN, STAGES, type StageKey } from "../../convex/lib/garden";
import { Locked } from "@/components/game";
import { PlantArt } from "@/components/PlantArt";
import { HogCoin } from "@/components/HogCoin";
import { RemoteArt } from "@/components/RemoteArt";
import { Avatar, Button, Card, CardHeader, Dialog, Empty, PageHeader, PageSkeleton } from "@/components/ui";
import { useWorkspaceToday } from "@/lib/period";

type Mine = NonNullable<ReturnType<typeof useQuery<typeof api.gardens.mine>>>;
type OpenGarden = Extract<Mine, { open: true }>;
type Grown = OpenGarden["plants"][number];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const coins = (n: number) => plural(n, "Hog coin", "Hog coins");
/** A memory keeps its stage by name: draw it at that stage (a Seed if the name is unknown). */
const stageKeyOf = (name: string): StageKey => STAGES.find((s) => s.name === name)?.key ?? "seed";
const errorText = (e: unknown) => (e instanceof ConvexError ? String(e.data) : "Something went wrong. Try again.");

/**
 * Your garden (#55 §G8): a plant for each teammate you recognise, growing each week you thank them
 * thoughtfully. Plants grown for you are listed too; only you see those are yours. It opens at
 * level 3 with one plot; the Gardener skills add plots, early growth and the plant picker.
 */
export function Garden() {
  const today = useWorkspaceToday();
  const game = useQuery(api.game.mine, {});
  const mine = useQuery(api.gardens.mine, { today });
  const forMe = useQuery(api.gardens.forMe, { today });
  if (mine === undefined || game === undefined) return <PageSkeleton />;

  const header = (
    <PageHeader
      eyebrow="Your game"
      title="Your garden"
      subtitle="Grow a plant for a teammate you recognise. It grows each week you thank them with a few words on why, and it never dies."
      action={<GardenScene />}
    />
  );
  if (mine === null) {
    const [title, body] = !game.enabled
      ? ["The game is off in this workspace", "An admin can switch the game on in the settings. Your kudos work as always."]
      : ["The game is hidden", "You hid the game, so your garden is out of view. Show the game on My kudos to see it again."];
    return (
      <div>
        {header}
        <Card>
          <Empty icon={<Sprout className="h-7 w-7 text-faint" />} title={title}>
            {body}{" "}
            <Link to="/me" className="text-saffron underline-offset-4 hover:underline">
              Back to your kudos
            </Link>
          </Empty>
        </Card>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {header}
      {mine.open ? (
        <OwnGarden garden={mine} sunlamps={game.sunlamps ?? 0} />
      ) : (
        <Locked title="Your garden" level={mine.opensAt} how="At level 3 you can grow a plant for a teammate you recognise. Thoughtful kudos get you there." />
      )}
      <GrownForYou plants={forMe ?? []} />
      {mine.open && <Memories memories={mine.memories} />}
    </div>
  );
}

/**
 * posthog.com's Keyboard garden (#101): its key beds and gardening hedgehogs, PostHog's art from
 * PostHog's servers. A fixed box, so the header never moves while it loads; nothing if it can't.
 */
function GardenScene() {
  return <RemoteArt slot="garden-scene" fit="contain" className="-my-4 h-32 w-32 sm:-my-6 sm:h-44 sm:w-44" />;
}

function OwnGarden({ garden, sunlamps }: { garden: OpenGarden; sunlamps: number }) {
  const [planting, setPlanting] = useState(false);
  const [uprooting, setUprooting] = useState<Grown | null>(null);
  const empty = Math.max(0, garden.plots - garden.plants.length);
  return (
    <>
      <Harvest garden={garden} />
      <div className="flex items-baseline justify-between gap-3 text-xs text-muted">
        <span>
          {plural(garden.plants.length, "plant", "plants")} · {plural(garden.plots, "plot", "plots")}
          {garden.plants.length > garden.plots && " (uproot one to plant again)"}
        </span>
        <span className="inline-flex items-center gap-1.5 tabular">
          <HogCoin size={16} />
          {coins(garden.balance)}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {garden.plants.map((p) => (
          <PlantCard key={p.plantId} plant={p} sunlamps={sunlamps} onUproot={() => setUprooting(p)} />
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <EmptyPlot key={i} canPlant={garden.candidates.length > 0} onPlant={() => setPlanting(true)} />
        ))}
      </div>
      <PlantDialog garden={garden} open={planting} onClose={() => setPlanting(false)} />
      <UprootDialog plant={uprooting} onClose={() => setUprooting(null)} />
    </>
  );
}

function stageLine(plant: Pick<Grown, "waterings" | "awakeDays" | "next">) {
  if (!plant.next) return "The oldest a plant grows.";
  const { next } = plant;
  return `${plant.waterings} of ${next.waterings} waterings · ${Math.min(plant.awakeDays, next.days)} of ${next.days} days to ${next.name}`;
}

/** One plant in a plot. `forName` only in your own garden; `forYou` only in someone else's. */
function PlantFace({
  plant,
  forName,
  forYou,
  action,
  footer,
  onTakeDownLantern,
}: {
  plant: Pick<Grown, "plantId" | "species" | "speciesName" | "stage" | "stageName" | "dormant"> & Partial<Pick<Grown, "waterings" | "awakeDays" | "next" | "fruit" | "lantern" | "goldenLeaves">>;
  forName?: string;
  forYou?: boolean;
  action?: React.ReactNode;
  /** Extra controls under the plant (a Sunlamp, a Lantern). */
  footer?: React.ReactNode;
  /** The owner may take a teammate's lantern down. */
  onTakeDownLantern?: () => void;
}) {
  const fruit = plant.fruit?.length ?? 0;
  return (
    <Card
      data-plot
      data-plant={plant.plantId}
      data-dormant={plant.dormant ? "true" : "false"}
      className={clsx("flex gap-3 p-4", plant.dormant && "border-saffron-deep/40 bg-saffron-deep/5", forYou && "border-saffron/50")}
    >
      <PlantArt stage={plant.stage as StageKey} species={plant.species} dormant={plant.dormant} fruit={fruit} goldenLeaves={plant.goldenLeaves ?? 0} size={96} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-medium text-cream">{plant.speciesName}</div>
            {forName && <div className="truncate text-xs text-muted">for {forName}</div>}
            {forYou && <div className="text-xs font-medium text-saffron">Growing for you</div>}
          </div>
          {action}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full border border-line-strong px-2 py-0.5 text-cream/80">{plant.stageName}</span>
          {plant.dormant && <span className="rounded-full bg-saffron-deep/20 px-2 py-0.5 text-saffron">Dormant</span>}
          {fruit > 0 && <span className="rounded-full bg-saffron/15 px-2 py-0.5 text-saffron">{plural(fruit, "fruit", "fruit")}</span>}
          {(plant.goldenLeaves ?? 0) > 0 && (
            // A golden leaf per Super kudos you sent them (#98), drawn on the plant too (#101).
            <span data-art-slot="golden-leaf" className="rounded-full bg-[#f7a501]/20 px-2 py-0.5 text-[#fde68a]">
              {plural(plant.goldenLeaves!, "golden leaf", "golden leaves")}
            </span>
          )}
        </div>
        {plant.next !== undefined && <p className="mt-2 text-xs text-muted">{stageLine(plant as Grown)}</p>}
        {plant.dormant && forName && <p className="mt-1 text-xs text-muted">Dormant for now: thank {forName} with a few words on why to wake it.</p>}
        {plant.lantern && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-saffron/10 px-2 py-1.5 text-xs text-cream/90">
            <Lamp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-saffron" aria-hidden />
            <span className="min-w-0 flex-1 break-words">
              Lantern from {plant.lantern.by}: “{plant.lantern.note}”
            </span>
            {onTakeDownLantern && (
              <button
                type="button"
                aria-label={`Take down ${plant.lantern.by}'s lantern`}
                title="Take it down"
                onClick={onTakeDownLantern}
                className="shrink-0 rounded p-0.5 text-faint hover:text-muted"
              >
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

function PlantCard({ plant, sunlamps, onUproot }: { plant: Grown; sunlamps: number; onUproot: () => void }) {
  const label = `Uproot ${plant.speciesName} for ${plant.forName}`;
  const applySunlamp = useMutation(api.gardens.useSunlamp);
  const takeDown = useMutation(api.gardens.takeDownLantern);
  const [error, setError] = useState<string | null>(null);
  const run = (p: Promise<unknown>) => {
    setError(null);
    p.catch((e) => setError(errorText(e)));
  };
  const lampLabel = `Use a Sunlamp on ${plant.speciesName} for ${plant.forName} (${sunlamps} left)`;
  return (
    <PlantFace
      plant={plant}
      forName={plant.forName}
      onTakeDownLantern={() => run(takeDown({ plantId: plant.plantId }))}
      footer={
        <>
          {plant.sunlamp && sunlamps > 0 && (
            <Button size="sm" variant="outline" className="mt-2" aria-label={lampLabel} title={lampLabel} onClick={() => run(applySunlamp({ plantId: plant.plantId }))}>
              <Sun className="h-3.5 w-3.5" aria-hidden /> Use a Sunlamp · 5 days sooner
            </Button>
          )}
          {error && <p className="mt-1 text-xs text-down">{error}</p>}
        </>
      }
      action={
        <button type="button" aria-label={label} title={label} onClick={onUproot} className="rounded-lg p-1 text-faint transition hover:bg-panel-2 hover:text-muted">
          <Shovel className="h-4 w-4" aria-hidden />
        </button>
      }
    />
  );
}

function EmptyPlot({ canPlant, onPlant }: { canPlant: boolean; onPlant: () => void }) {
  return (
    <div data-plot className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center">
      <div className="relative">
        <PlantArt stage="seed" size={72} />
        {/* A gardening hoggie waits by the plot: PostHog's art, nothing if it can't load. */}
        <RemoteArt slot="hoggie-empty-plot" fit="contain" className="absolute -right-12 bottom-0 h-14 w-14" />
      </div>
      <div className="text-sm font-medium text-cream/70">Empty plot</div>
      <Button size="sm" onClick={onPlant} disabled={!canPlant}>
        Plant a seed
      </Button>
      {!canPlant && <p className="max-w-[16rem] text-xs text-muted">Thank a teammate in Slack with a few words on why. For 7 days after, you can plant for them here.</p>}
    </div>
  );
}

function Harvest({ garden }: { garden: OpenGarden }) {
  const pick = useMutation(api.gardens.pick);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fruit = garden.plants.flatMap((p) => p.fruit);
  const worth = fruit.reduce((s, f) => s + f.coins, 0);
  const { harvest } = garden;
  if (garden.plants.length === 0) return null;
  const onPick = async () => {
    setBusy(true);
    try {
      const r = await pick({});
      setResult(r.fruit === 0 ? "This week's fruit is all in: the rest waits on your plants." : `Picked ${plural(r.fruit, "fruit", "fruit")}: +${coins(r.coins)}, +${r.xp} XP.`);
    } catch (e) {
      setResult(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <Apple className="h-5 w-5 shrink-0 text-saffron" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium text-cream">{fruit.length > 0 ? `${plural(fruit.length, "fruit", "fruit")} waiting · ${coins(worth)}` : "No fruit waiting"}</div>
        <div className="text-xs text-muted">
          A Grown plant fruits daily while you've thanked its teammate in the last 14 days, and holds {harvest.hold}. This week from fruit: {harvest.weekCoins} of {harvest.capCoins} Hog coins ·{" "}
          {harvest.weekXp} of {harvest.capXp} XP.
        </div>
        {result && (
          <div role="status" className="mt-1 text-xs text-saffron">
            {result}
          </div>
        )}
      </div>
      <Button variant="primary" size="sm" disabled={fruit.length === 0 || busy} onClick={() => void onPick()}>
        Pick fruit
      </Button>
    </Card>
  );
}

function PlantDialog({ garden, open, onClose }: { garden: OpenGarden; open: boolean; onClose: () => void }) {
  const plant = useMutation(api.gardens.plant);
  const [teammate, setTeammate] = useState<Id<"members"> | null>(null);
  const [species, setSpecies] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const short = garden.balance < garden.cost;
  const close = () => {
    setTeammate(null);
    setSpecies("");
    setError(null);
    onClose();
  };
  const submit = async () => {
    if (!teammate) return;
    setBusy(true);
    setError(null);
    try {
      await plant({ teammateId: teammate, ...(species ? { species } : {}) });
      close();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title="Plant a seed"
      subtitle={`A plant costs ${coins(garden.cost)}; you have ${garden.balance}. Only they will see it's for them.`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={!teammate || busy || short} onClick={() => void submit()}>
            Plant for {coins(garden.cost)}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 p-5">
        <p className="text-sm text-muted">Teammates you thanked thoughtfully in the last 7 days:</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {garden.candidates.map((c) => (
            <li key={c.memberId}>
              <button
                type="button"
                data-candidate={c.memberId}
                aria-pressed={teammate === c.memberId}
                onClick={() => setTeammate(c.memberId)}
                className={clsx(
                  "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition",
                  teammate === c.memberId ? "border-saffron bg-saffron/10 text-cream" : "border-line-strong text-cream/80 hover:bg-panel-2",
                )}
              >
                <Avatar name={c.name} src={c.avatarUrl} size={24} />
                <span className="truncate">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
        {garden.species.length > 0 && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Species (your plant picker)</span>
            <select value={species} onChange={(e) => setSpecies(e.target.value)} className="h-10 rounded-xl border border-line-strong bg-ink/60 px-3 text-cream">
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
        {short && <p className="text-xs text-muted">Thoughtful kudos earn Hog coins: you need {garden.cost - garden.balance} more.</p>}
        {error && (
          <p role="alert" className="text-sm text-down">
            {error}
          </p>
        )}
      </div>
    </Dialog>
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
          <Button variant="primary" disabled={busy} onClick={() => void confirm()}>
            Uproot
          </Button>
        </div>
      }
    >
      <div className="px-5 py-3">
        {error && (
          <p role="alert" className="text-sm text-down">
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
      <CardHeader title="Grown for you" subtitle="Only you can see these plants are yours." icon={<Flower2 className="h-4 w-4 text-saffron" />} />
      <ul className="px-5 pb-5">
        {plants.map((p) => (
          <li key={p.plantId} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
            <PlantArt stage={p.stage as StageKey} species={p.species} dormant={p.dormant} goldenLeaves={p.goldenLeaves} size={48} />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-cream">
                {p.ownerName} is growing a {p.speciesName} for you
              </div>
              <div className="text-xs text-muted">
                {p.dormant ? `${p.stageName}, dormant for now` : p.stageName}
                {p.goldenLeaves > 0 && <span className="text-[#fde68a]"> · {plural(p.goldenLeaves, "golden leaf", "golden leaves")} from {p.ownerName}'s Super kudos</span>}
              </div>
              {p.lantern && (
                <div className="text-xs text-cream/80">
                  Lantern from {p.lantern.by}: “{p.lantern.note}”{" "}
                  <button type="button" className="text-faint underline-offset-4 hover:text-muted hover:underline" onClick={() => void takeDown({ plantId: p.plantId }).catch(() => {})}>
                    Take it down
                  </button>
                </div>
              )}
            </div>
            <Link to={`/garden/${p.ownerId}`} className="shrink-0 text-xs text-saffron underline-offset-4 hover:underline">
              {p.ownerName}'s garden
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Memories({ memories }: { memories: OpenGarden["memories"] }) {
  if (memories.length === 0) return null;
  return (
    <Card>
      <CardHeader title="Memories" subtitle="Plants you uprooted, and plants grown for teammates who left." />
      <ul data-memories className="px-5 pb-5">
        {memories.map((m) => (
          <li key={m.plantId} className="flex items-center justify-between gap-3 border-t border-line py-2 text-sm first:border-t-0">
            {/* A memory is the plant as it was, faded. */}
            <span className="opacity-60 grayscale-[40%]">
              <PlantArt stage={stageKeyOf(m.stageName)} species={m.species} size={40} />
            </span>
            <span className="min-w-0 flex-1 truncate text-cream/80">
              {m.speciesName} for {m.forName}
            </span>
            <span className="shrink-0 text-xs text-muted">
              {m.stageName} · {m.reason === "left" ? "they left" : `uprooted ${m.memoryDay}`}
            </span>
          </li>
        ))}
      </ul>
    </Card>
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
      <div>
        <PageHeader eyebrow="Gardens" title="Garden" />
        <Card>
          <Empty icon={<Sprout className="h-7 w-7 text-faint" />} title="This garden isn't here">
            It may belong to someone who left, or the game is off or hidden.{" "}
            <Link to="/garden" className="text-saffron underline-offset-4 hover:underline">
              Your garden
            </Link>
          </Empty>
        </Card>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow="Gardens" title={`${garden.name}'s garden`} subtitle="Every plant here is for a teammate. Only they know which one is theirs." />
      {garden.plants.length === 0 ? (
        <Card>
          <Empty icon={<Sprout className="h-7 w-7 text-faint" />} title="Nothing planted yet" />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

/** Hangs one of the viewer's Lanterns (#97) on a teammate's plant: a one-line note for 7 days. */
function LanternForm({ plantId, lanterns }: { plantId: Id<"plants">; lanterns: number }) {
  const hang = useMutation(api.gardens.hangLantern);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpen(true)} title={`${lanterns} left`}>
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
        className="h-8 w-full rounded-lg border border-line-strong bg-ink/60 px-2 text-xs text-cream outline-none focus:border-saffron/60"
        maxLength={LANTERN.maxChars}
        placeholder="One line for everyone who sees this plant"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="primary" onClick={submit} disabled={note.trim().length === 0}>
          Hang it
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Not now
        </Button>
        <span className="ml-auto text-[10px] text-faint">Glows for {LANTERN.days} days</span>
      </div>
      {error && <p className="text-xs text-down">{error}</p>}
    </div>
  );
}
