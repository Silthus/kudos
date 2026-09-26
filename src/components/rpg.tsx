import { useMutation, useQuery } from "convex/react";
import clsx from "clsx";
import { useState } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { FRUIT_BY_ID, type FruitId } from "../../convex/lib/fruits";
import { GEAR, GEAR_IDS, isGearId, RUIN, type CreatureId, type GearSlot } from "../../convex/lib/rpg";
import { HogCoin } from "@/components/HogCoin";
import { Button } from "@/components/ui";
import { FruitArt } from "@/world/FruitArt";
import { PixelArt } from "@/world/PixelArt";
import { CREATURE_ART, unmetArt } from "@/world/rpg/bestiary";
import { GEAR_ART } from "@/world/rpg/gear";
import { ruinPath } from "@/world/places/ruins";
import { errorText } from "@/lib/errors";

/**
 * The desert RPG's pieces outside a ruin (#162): gear and stamina in pixels, the cabin's camp card
 * (stamina, the three slots and the gear you hold), the gallery's bestiary and lore cards, and the
 * results ledger a run ends with.
 */


export const SLOT_NAME: Record<GearSlot, string> = { hat: "Hat", tool: "Tool", charm: "Charm" };
/** The slots in their natural order: the order the first pieces of gear name them. */
const SLOTS = [...new Set(GEAR_IDS.map((id) => GEAR[id].slot))];

export function GearArt({ id, size = 32 }: { id: string; size?: number }) {
  if (!isGearId(id)) return null;
  return (
    <span data-gear-art={id} className="inline-flex shrink-0">
      <PixelArt map={GEAR_ART[id]} width={size} height={size} />
    </span>
  );
}

/** Stamina as five pixel pips, lit for each one you have. */
export function StaminaPips({ stamina, max = 5 }: { stamina: number; max?: number }) {
  return (
    <span data-stamina={stamina} role="img" aria-label={`Stamina ${stamina} of ${max}`} className="inline-flex gap-1 align-middle">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          aria-hidden
          data-pip={i < stamina ? "full" : "empty"}
          className={clsx("block h-3.5 w-3.5 border-2 border-bark shadow-[2px_2px_0_0_var(--color-dusk-deep)]", i < stamina ? "bg-sap" : "bg-parchment-deep")}
        />
      ))}
    </span>
  );
}

/**
 * The cabin's camp card: your stamina, the three gear slots with what you wear, and every piece you
 * hold with a button to wear it. Before level 6 it says when the near ruins open to you.
 */
export function CampCard() {
  const camp = useQuery(api.rpg.camp);
  const equip = useMutation(api.rpg.equip);
  const [error, setError] = useState<string | null>(null);
  if (!camp) return null;
  const wear = async (slot: GearSlot, gearId: string | null) => {
    setError(null);
    try {
      await equip({ slot, gearId });
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <section data-camp aria-labelledby="camp" className="border-2 border-bark bg-parchment-deep p-4 shadow-[3px_3px_0_0_var(--color-dusk-deep)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="camp" className="font-display text-lg font-medium text-ink">
          Your expedition kit
        </h3>
        <span className="flex items-center gap-2 text-sm text-ink">
          Stamina <StaminaPips stamina={camp.stamina} max={camp.maxStamina} />
        </span>
      </div>
      <p className="mt-1 text-sm text-ink/75">
        {camp.explorer
          ? `Every thoughtful kudos you give restores one stamina; an expedition costs one. ${camp.ruinsCleared === 1 ? "1 ruin" : `${camp.ruinsCleared} ruins`} explored, ${camp.lore} of ${RUIN.lores} lore cards found.`
          : `The near ruins open to you at level 6. Every thoughtful kudos you give until then restores one stamina for your first expedition.`}
      </p>
      <ul className="mt-3 grid grid-cols-3 gap-2" aria-label="Worn">
        {SLOTS.map((slot) => {
          const id = camp.equipped[slot];
          const piece = camp.gear.find((g) => g.id === id);
          return (
            <li key={slot} data-slot={slot} className="flex flex-col items-center gap-1 border-2 border-bark bg-parchment p-2 text-center text-xs text-ink">
              <span className="font-display text-sm">{SLOT_NAME[slot]}</span>
              <span className="grid h-10 w-10 place-items-center bg-parchment-deep">{id ? <GearArt id={id} size={36} /> : <span className="text-ink/50">Empty</span>}</span>
              <span className="min-h-8">{piece ? piece.name : ""}</span>
              {id && (
                <button type="button" className="font-semibold text-ember-deep underline underline-offset-2" onClick={() => void wear(slot, null)}>
                  Take off
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-ink">
        Might {camp.stats.might}, wits {camp.stats.wits}, heart {camp.stats.heart}
      </p>
      <NearRuins />
      {camp.gear.length === 0 ? (
        <p className="mt-2 text-sm text-ink/75">
          No gear yet. The ruins hold some, and the{" "}
          <Link to="/store" className="font-semibold text-ember-deep underline decoration-2 underline-offset-4">
            stall
          </Link>{" "}
          sells a few common pieces.
        </p>
      ) : (
        <ul className="mt-2 space-y-2 border-t-4 border-bark pt-2">
          {camp.gear.map((g) => {
            const worn = camp.equipped[g.slot as GearSlot] === g.id;
            return (
              <li key={g.id} data-gear={g.id} className="flex items-center gap-3 text-sm text-ink">
                <GearArt id={g.id} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{g.name}</span>{" "}
                  <span className="text-ink/75">
                    +{g.bonus} {g.stat}, {g.slot}. {g.about}
                  </span>
                </span>
                {worn ? (
                  <span className="text-xs font-semibold text-ink/70">Worn</span>
                ) : (
                  <Button size="sm" onClick={() => void wear(g.slot as GearSlot, g.id)}>
                    Wear
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-ember-deep">
          {error}
        </p>
      )}
    </section>
  );
}

/** The near ruins the tree has opened, as links: walk there from here, or find them in the sand. */
function NearRuins() {
  const tree = useQuery(api.tree.state);
  const near = tree?.layout.ruins.filter((r) => r.tier === 1) ?? [];
  if (near.length === 0) return null;
  return (
    <p data-near-ruins className="mt-2 text-sm text-ink">
      The near ruins:{" "}
      {near.map((r, i) => (
        <span key={r.id}>
          {i > 0 && ", "}
          <Link to={ruinPath(r.id)} className="font-semibold text-ember-deep underline decoration-2 underline-offset-4">
            {r.name}
          </Link>
        </span>
      ))}
      .
    </p>
  );
}

type Loot = { coins: number; fruits: string[]; gear: { id: string; name: string }[]; lore: { lore: number; title: string }[] };

const ENDINGS = {
  cleared: "Cleared. The ruin gave up what it kept.",
  fallen: "You fell and woke at camp. Nothing is lost.",
  retreated: "You returned to camp.",
} as const;

/** How a run ended and what it brought, line by line. */
export function ResultsLedger({ state, loot }: { state: "cleared" | "fallen" | "retreated"; loot: Loot }) {
  const empty = loot.coins === 0 && loot.fruits.length === 0 && loot.gear.length === 0 && loot.lore.length === 0;
  return (
    <section data-results={state} aria-labelledby="results" className="border-2 border-bark bg-parchment px-3 pt-3 pb-1 text-sm text-ink shadow-[3px_3px_0_0_var(--color-dusk-deep)]">
      <h3 id="results" className="font-display text-lg font-medium">
        {ENDINGS[state]}
      </h3>
      <ul className="mt-2 [&>li]:pb-2">
        {loot.coins > 0 && (
          <li data-loot="coins" className="flex items-center gap-2 font-semibold">
            <HogCoin size={16} />
            {loot.coins} Hog coins into your wallet.
          </li>
        )}
        {[...new Set(loot.fruits)].map((f) => {
          const n = loot.fruits.filter((x) => x === f).length;
          return (
            <li key={f} data-loot="fruit" className="flex items-center gap-2">
              <FruitArt fruit={f as FruitId} size={22} />
              {n === 1 ? `A ${FRUIT_BY_ID[f as FruitId].name.toLowerCase()}` : `${n} ${FRUIT_BY_ID[f as FruitId].name.toLowerCase()}`}, on your shelf.
            </li>
          );
        })}
        {loot.gear.map((g, i) => (
          <li key={`g${i}`} data-loot="gear" className="flex items-center gap-2">
            <GearArt id={g.id} size={26} />
            <span>
              <span className="font-semibold">{g.name}</span>, waiting in your cabin to be worn.
            </span>
          </li>
        ))}
        {loot.lore.map((l) => (
          <li key={l.lore} data-loot="lore" className="flex items-center gap-2">
            <span aria-hidden className="block h-6 w-5 border-2 border-bark bg-parchment-deep shadow-[inset_0_-3px_0_0_var(--color-sap)]" />
            <span>
              A secret: the lore card <span className="font-semibold">“{l.title}”</span>, now in{" "}
              <Link to="/discoveries#lore" className="font-semibold text-ember-deep underline decoration-2 underline-offset-4">
                the gallery
              </Link>
              .
            </span>
          </li>
        ))}
        {empty && <li className="text-ink/75">{state === "cleared" ? "Nothing but the way out." : "Nothing from the room you left."}</li>}
      </ul>
    </section>
  );
}

/** The gallery's bestiary: every creature of the ruins, a shadow until you've met it. */
export function Bestiary() {
  const creatures = useQuery(api.rpg.bestiary);
  if (!creatures) return null;
  const met = creatures.filter((c) => c.met).length;
  return (
    <section data-bestiary aria-labelledby="bestiary" className="space-y-3">
      <div>
        <h2 id="bestiary" className="font-display text-xl font-medium">
          The bestiary
        </h2>
        <p className="text-sm text-ink/75">
          {met} of {creatures.length} creatures of the ruins met.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-3 @md:grid-cols-3">
        {creatures.map((c) => (
          <li key={c.id} data-creature={c.id} data-met={c.met} className="flex flex-col items-center gap-1 border-2 border-bark bg-parchment-deep p-3 text-center">
            <PixelArt map={c.met ? CREATURE_ART[c.id as CreatureId] : unmetArt(c.id as CreatureId)} width={64} height={56} label={c.name ?? "A creature not met yet"} />
            <span className="font-display text-base">{c.name ?? "Not met yet"}</span>
            <span className="text-xs text-ink/75">{c.about ?? `Somewhere in the ${c.tier === 1 ? "near" : c.tier === 2 ? "far" : "deep"} ruins.`}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The gallery's lore cards: the tree's twelve secrets, words hidden until found. */
export function LoreCards() {
  const lore = useQuery(api.discoveries.lore);
  if (!lore) return null;
  return (
    <section id="lore" data-lore aria-labelledby="lore-title" className="space-y-3">
      <div>
        <h2 id="lore-title" className="font-display text-xl font-medium">
          Lore cards
        </h2>
        <p className="text-sm text-ink/75">{lore.found} of {RUIN.lores} secrets of the ruins found. Each is kept in a hidden room, or waits at the end of a cleared run.</p>
      </div>
      <ul className="grid grid-cols-1 gap-3 @md:grid-cols-2">
        {lore.cards.map((card) => (
          <li
            key={card.index}
            data-lore-card={card.index}
            data-found={card.text !== null}
            className={clsx("border-2 border-bark p-3 shadow-[3px_3px_0_0_var(--color-dusk-deep)]", card.text ? "bg-parchment" : "bg-parchment-deep text-ink/60")}
          >
            <p className="font-display text-base text-ink">{card.title ?? "A secret not found yet"}</p>
            {card.text && <p className="mt-1 text-sm leading-relaxed text-ink">{card.text}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
