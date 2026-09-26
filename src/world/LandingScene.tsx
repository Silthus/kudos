import clsx from "clsx";
import { useEffect, useRef } from "react";
import type { SpeciesId, StageKey } from "../../convex/lib/garden";
import { HOG_FEET, HOG_SIZE, HogFrame } from "./Hog";
import { CANVAS_H, CANVAS_W, paintWorld, tileOnCanvas, type WorldFurniture } from "./paint";
import { PLACES } from "./places";
import { plantSprite } from "./plants";
import { GARDEN, WORLD } from "./tiles";

/**
 * The world seen from above at dusk, for visitors who haven't signed in yet (#133): the same map the
 * signed-in world walks on, painted once with every place and a garden in full growth, and PostHog's
 * hedgehog standing still at your garden's front gate. Nothing moves and nothing is clickable: it's a
 * picture (`aria-hidden`), and the page around it says what it is.
 *
 * The scene is shown at a whole-number scale, `--s` (2, like the world on a phone), centred on your
 * garden and cut to its box, so a phone sees the garden and a desktop the whole world.
 */

/** Your front gate: where the hedgehog stands, in the garden's front fence facing the viewer (on the path out of the square). */
export const GATE = { x: WORLD.spawn.x + 1, y: GARDEN.y1 };

/** A garden well tended: your key beds in every stage, and the neighbours' beds round it. */
const MY_PLANTS: [StageKey, SpeciesId, number?][] = [
  ["blossoming", "generous_cherry", 3],
  ["grown", "helpful_oak", 2],
  ["young", "bright_sunflower"],
  ["grown", "patient_pine", 1],
  ["sapling", "kind_maple"],
  ["young", "golden_willow"],
  ["sprout", "wise_ginkgo"],
  ["grown", "curious_fern"],
];
const NEIGHBOURS: [StageKey, SpeciesId][] = [
  ["grown", "kind_maple"],
  ["young", "helpful_oak"],
  ["sapling", "patient_pine"],
  ["grown", "bright_sunflower"],
  ["young", "steady_birch"],
  ["sprout", "curious_fern"],
  ["grown", "brave_cedar"],
  ["young", "golden_willow"],
  ["sapling", "wise_ginkgo"],
  ["grown", "generous_cherry"],
];

export function landingFurniture(): WorldFurniture {
  return {
    plots: WORLD.plots.map((_, i) => {
      const plant = MY_PLANTS[i];
      return plant ? plantSprite({ stage: plant[0], species: plant[1], fruit: plant[2] ?? 0 }) : null;
    }),
    beds: NEIGHBOURS.slice(0, WORLD.beds.length).map(([stage, species], i) => ({ tile: WORLD.beds[i], sprite: plantSprite({ stage, species, bed: false, mini: true }) })),
  };
}

export function LandingScene({ className }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(CANVAS_W, CANVAS_H);
    paintWorld(img, WORLD, PLACES, landingFurniture());
    ctx.putImageData(img, 0, 0);
  }, []);

  const centre = tileOnCanvas(WORLD.spawn);
  const gate = tileOnCanvas(GATE);
  return (
    // The stage is the whole world at `--s`, its centre on your garden's: the box cuts it.
    <div aria-hidden className={clsx("relative overflow-hidden bg-dusk [--s:2]", className)}>
      <div
        className="absolute"
        style={{
          width: `calc(${CANVAS_W}px * var(--s))`,
          height: `calc(${CANVAS_H}px * var(--s))`,
          left: `calc(50% - ${centre.x}px * var(--s))`,
          top: `calc(50% - ${centre.y}px * var(--s))`,
        }}
      >
        <canvas ref={canvas} width={CANVAS_W} height={CANVAS_H} aria-hidden data-landing-world className="pixels absolute inset-0 h-full w-full" />
        <div
          data-landing-hog
          className="absolute"
          style={{ left: `calc(${gate.x}px * var(--s) - ${HOG_SIZE / 2}px)`, top: `calc(${gate.y}px * var(--s) - ${HOG_FEET}px)` }}
        >
          <HogFrame />
        </div>
      </div>
    </div>
  );
}
