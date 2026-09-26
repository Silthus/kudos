import clsx from "clsx";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useReducedMotionConfig } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { HOG_ACCESSORIES, HOG_COLORS, type Look } from "../../convex/lib/presence";
import { Hog } from "./Hog";
import { ACCESSORY_NAMES, COLOR_NAMES } from "./look";

/**
 * Your hedgehog's look, in the cabin (#158, #155 `setLook`): one of Hedgehog Mode's colours and one
 * of its accessories, or none, shown on your hedgehog as you choose and worn in the world at once
 * (everyone round you sees it with your next heartbeat). The lists are Hedgehog Mode's own.
 * Before your first kudos there's no player to dress; a refusal says why and puts the look back.
 */
export function HogLookPicker() {
  const game = useQuery(api.game.mine, {});
  const setLook = useMutation(api.presence.setLook);
  const still = !!useReducedMotionConfig();
  /** What you chose last, until it's saved and your game brings it back (or it's refused). */
  const [draft, setDraft] = useState<Look | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Your choices so far, and the last of them the server has answered: only the latest counts. */
  const asked = useRef(0);
  const [answered, setAnswered] = useState(0);
  const saved = game?.look;
  useEffect(() => {
    if (draft && saved && answered === asked.current && draft.color === saved.color && draft.accessory === saved.accessory) setDraft(null);
  }, [draft, saved, answered]);
  if (!game) return null;
  if (!game.player) return <p className="text-sm text-ink/75">Your hog's look opens with your first kudos.</p>;
  const look = draft ?? game.look;

  const choose = (next: Look) => {
    const n = ++asked.current;
    setDraft(next);
    setError(null);
    setLook(next).then(
      () => n === asked.current && setAnswered(n),
      (e: unknown) => {
        // An earlier choice refused while a later one is on its way: the later one speaks.
        if (n !== asked.current) return;
        setAnswered(n);
        setDraft(null);
        setError(e instanceof ConvexError ? String(e.data) : "Your look couldn't be saved. Try again.");
      },
    );
  };

  const chip = (on: boolean) => clsx("pixel-chip px-2.5 py-1 text-sm", on ? "bg-lantern font-semibold text-ink" : "bg-parchment text-ink/80 hover:bg-parchment-deep/60");
  return (
    <div className="flex flex-col gap-4 @md:flex-row @md:items-start">
      <div data-hog-preview className="pixel-chip grid h-40 w-40 shrink-0 place-items-center bg-dusk-deep">
        {/* Twice the world's own size, pixel for pixel. */}
        <Hog still={still} look={look} className="scale-[2]" />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <h4 className="text-xs font-semibold text-ink/75">Colour</h4>
          <div role="group" aria-label="Colour" className="mt-1.5 flex flex-wrap gap-1.5">
            {[null, ...HOG_COLORS].map((c) => (
              <button key={c ?? "none"} type="button" aria-pressed={look.color === c} onClick={() => choose({ ...look, color: c })} className={chip(look.color === c)}>
                {c ? COLOR_NAMES[c] : "None"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-ink/75">Wearing</h4>
          <div role="group" aria-label="Wearing" className="mt-1.5 flex flex-wrap gap-1.5">
            {[null, ...HOG_ACCESSORIES].map((a) => (
              <button key={a ?? "none"} type="button" aria-pressed={look.accessory === a} onClick={() => choose({ ...look, accessory: a })} className={chip(look.accessory === a)}>
                {a ? ACCESSORY_NAMES[a] : "None"}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-ink/75">On a bonus day everyone wears the party hat.</p>
        {error && (
          <p role="alert" className="text-sm font-semibold text-ember-deep">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
