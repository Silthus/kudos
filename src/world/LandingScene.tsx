import clsx from "clsx";
import { useEffect, useRef } from "react";
import { TREE_STAGE_BY_ID, layout } from "../../convex/lib/tree";
import type { SpeciesId, StageKey } from "../../convex/lib/garden";
import { HOG_FEET, HOG_SIZE, HogFrame } from "./Hog";
import { paintGround, paintStanding, standingRect, tileOnCanvas, treeFoot, type ArtRect, type WorldFurniture } from "./paint";
import { PLACES } from "./places";
import { plantSprite } from "./plants";
import { buildWorld, type World } from "./world";

/**
 * The world seen from above at dusk, for visitors who haven't signed in yet (#133, #156): the desert
 * with an elder Ancient Tree in its middle and every district open round it, painted once, with
 * PostHog's hedgehog standing still in base camp. Nothing moves and nothing is clickable: it's a
 * picture (`aria-hidden`), and the page around it says what it is.
 *
 * The scene is shown at a whole-number scale, `--s` (2, like the world on a phone), centred on the
 * tree and cut to its box, so a phone sees the tree and base camp and a desktop the districts too.
 */

const SEED = 20_260_926;
const GROWTH = TREE_STAGE_BY_ID.elder.growth;
/** How far out the ground is painted, in tiles from the tree. */
const REACH = 30;

/** Where the hedgehog stands: base camp, in front of the offering stone. */
export const LANDING_SPOT = { x: 4, y: 4 };

/** A garden well tended: your key beds in every stage, and the neighbours' beds round it. */
const MY_PLANTS: [StageKey, SpeciesId, number?][] = [
  ["blossoming", "generous_cherry", 3],
  ["grown", "helpful_oak", 2],
  ["young", "bright_sunflower"],
  ["grown", "patient_pine", 1],
  ["sapling", "kind_maple"],
  ["young", "golden_willow"],
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
];

export function landingWorld(): World {
  return buildWorld({ seed: SEED, layout: layout(SEED, GROWTH), peakGrowth: GROWTH, planted: true, standing: PLACES.map((p) => p.id) });
}

export function landingFurniture(world: World): WorldFurniture {
  return {
    plots: world.plots.map((_, i) => {
      const plant = MY_PLANTS[i];
      return plant ? plantSprite({ stage: plant[0], species: plant[1], fruit: plant[2] ?? 0 }) : null;
    }),
    beds: NEIGHBOURS.slice(0, world.beds.length).map(([stage, species], i) => ({ tile: world.beds[i], sprite: plantSprite({ stage, species, bed: false, mini: true }) })),
  };
}

/** The picture: the ground out to `REACH` tiles and everything standing, in one rectangle. */
function sceneRect(world: World, furniture: WorldFurniture): ArtRect {
  const standing = standingRect(world, furniture);
  const x0 = Math.min(standing.x, -2 * REACH * 8 - 8);
  const y0 = Math.min(standing.y, -2 * REACH * 4);
  const x1 = Math.max(standing.x + standing.width, 2 * REACH * 8 + 8);
  const y1 = Math.max(standing.y + standing.height, (2 * REACH + 2) * 4);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

const SCENE = landingWorld();
const FURNITURE = landingFurniture(SCENE);
const RECT = sceneRect(SCENE, FURNITURE);
/** The picture's rectangle of art space. */
export const LANDING_RECT = RECT;

export function LandingScene({ className }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(RECT.width, RECT.height);
    paintGround(img, RECT, SCENE, { x0: -REACH, y0: -REACH, x1: REACH, y1: REACH });
    paintStanding(img, RECT, SCENE, FURNITURE);
    ctx.putImageData(img, 0, 0);
  }, []);

  // Centred a little above the tree's foot, so its canopy and base camp share the frame.
  const foot = treeFoot(SCENE);
  const centre = { x: foot.x - RECT.x, y: foot.y - 60 - RECT.y };
  const spot = tileOnCanvas(LANDING_SPOT);
  return (
    // The stage is the whole picture at `--s`, its centre on the tree's: the box cuts it.
    <div aria-hidden className={clsx("relative overflow-hidden bg-dusk [--s:2]", className)}>
      <div
        className="absolute"
        style={{
          width: `calc(${RECT.width}px * var(--s))`,
          height: `calc(${RECT.height}px * var(--s))`,
          left: `calc(50% - ${centre.x}px * var(--s))`,
          top: `calc(50% - ${centre.y}px * var(--s))`,
        }}
      >
        <canvas ref={canvas} width={RECT.width} height={RECT.height} aria-hidden data-landing-world className="pixels absolute inset-0 h-full w-full" />
        <div
          data-landing-hog
          className="absolute"
          style={{ left: `calc(${spot.x - RECT.x}px * var(--s) - ${HOG_SIZE / 2}px)`, top: `calc(${spot.y - RECT.y}px * var(--s) - ${HOG_FEET}px)` }}
        >
          <HogFrame />
        </div>
      </div>
    </div>
  );
}
