import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useState } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { fruitEffect, type FruitId } from "../../convex/lib/fruits";
import { SHOP_LEVEL } from "../../convex/lib/items";
import { Button } from "@/components/ui";
import { CoinsToWallet } from "@/world/CoinsToWallet";
import { FruitArt } from "@/world/FruitArt";

/**
 * Tree fruit (#157): what the tree drops when you offer your appreciation at the stone. Your cabin
 * keeps it on a shelf (`FruitShelf`); the stall sells it or uses it, one at a time, each by its one
 * effect (`FruitStall`, `api.offerings.applyFruit`).
 */

/** The one thing the stall does with a fruit, as its button says it. */
export function fruitAction(id: FruitId): string {
  const effect = fruitEffect(id);
  switch (effect.kind) {
    case "sell":
      return `Sell for ${effect.coins} Hog coins`;
    case "stamina":
      return `Eat for ${effect.amount} stamina`;
    case "luckyCharm":
      return "Add a Lucky charm charge";
    case "homeDiscount":
      return `Keep ${effect.percent}% off your home`;
    case "superSeed":
      return "Take a Super seed";
  }
}

function useShown() {
  const game = useQuery(api.game.mine);
  return !!game?.enabled && !game.hidden;
}

/** Your fruit on the cabin's shelf: each kind and how many, and the way to the stall once it's open. */
export function FruitShelf() {
  const game = useQuery(api.game.mine);
  const shown = !!game?.enabled && !game.hidden;
  const stallOpen = (game?.player?.level ?? 1) >= SHOP_LEVEL;
  const inventory = useQuery(api.offerings.inventory, shown ? {} : "skip");
  if (!shown || inventory === undefined) return null;
  return (
    <section data-fruit-shelf aria-labelledby="fruit-shelf" className="border-2 border-bark bg-parchment-deep p-4 shadow-[3px_3px_0_0_var(--color-dusk-deep)]">
      <h3 id="fruit-shelf" className="font-display text-lg font-medium text-ink">
        Your shelf
      </h3>
      {inventory.length === 0 ? (
        <p className="mt-1 text-sm text-ink/75">Offer your appreciation at the stone, and the tree drops fruit here for every 5 Hog coins you offer.</p>
      ) : (
        <>
          <ul className="mt-2 flex flex-wrap gap-3 border-b-4 border-bark pb-2">
            {inventory.map((f) => (
              <li key={f.fruit} data-fruit={f.fruit} title={f.about} className="flex items-center gap-1.5 text-sm text-ink">
                <FruitArt fruit={f.fruit} size={30} />
                <span>
                  {f.name}, <span className="font-semibold tabular">{f.count}</span>
                </span>
              </li>
            ))}
          </ul>
          {stallOpen ? (
            <Link to="/store" className="mt-2 inline-block text-sm font-semibold text-ember-deep underline decoration-2 underline-offset-4">
              Sell or use them at the stall
            </Link>
          ) : (
            <p className="mt-2 text-sm text-ink/75">The stall opens at level {SHOP_LEVEL}. Your fruit keeps here until then.</p>
          )}
        </>
      )}
    </section>
  );
}

/** The stall's fruit: each kind you hold with its one action. */
export function FruitStall() {
  const shown = useShown();
  const inventory = useQuery(api.offerings.inventory, shown ? {} : "skip");
  const applyFruit = useMutation(api.offerings.applyFruit);
  const [said, setSaid] = useState<{ fruit: FruitId; text: string } | null>(null);
  const [busy, setBusy] = useState<FruitId | null>(null);
  const [hop, setHop] = useState<{ from: HTMLElement; count: number; id: number } | null>(null);
  if (!shown || !inventory || inventory.length === 0) return null;
  const apply = async (fruit: FruitId, button: HTMLElement) => {
    setBusy(fruit);
    try {
      const done = await applyFruit({ fruit });
      setSaid({ fruit, text: done.said });
      // Sold fruit's coins hop from the button to your wallet, as picked garden fruit does.
      if (done.coins) setHop({ from: button, count: done.coins, id: Date.now() });
    } catch (e) {
      setSaid({ fruit, text: e instanceof ConvexError ? String(e.data) : "Something went wrong. Try again." });
    } finally {
      setBusy(null);
    }
  };
  return (
    <section data-shelf="fruit" aria-labelledby="fruit-stall" className="mb-8">
      <h2 id="fruit-stall" className="mb-1 font-display text-xl font-medium">
        Tree fruit
      </h2>
      <p className="mb-3 text-sm text-ink/75">What the tree dropped when you offered your appreciation. Each fruit does one thing.</p>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2">
        {inventory.map((f) => (
          <li key={f.fruit} data-fruit={f.fruit} className="flex items-start gap-3 border-2 border-bark bg-parchment p-3 shadow-[3px_3px_0_0_var(--color-dusk-deep)]">
            <FruitArt fruit={f.fruit} size={40} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">
                {f.name} <span className="font-normal text-ink/75 tabular">({f.count})</span>
              </p>
              <p className="text-sm text-ink/75">{f.about}</p>
              <Button size="sm" variant="outline" className="mt-2" disabled={busy !== null} onClick={(e) => void apply(f.fruit, e.currentTarget)}>
                {fruitAction(f.fruit)}
              </Button>
              {said?.fruit === f.fruit && (
                <p role="status" className="mt-1 text-sm text-soil">
                  {said.text}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {hop && <CoinsToWallet key={hop.id} from={hop.from} count={hop.count} onDone={() => setHop(null)} />}
    </section>
  );
}
