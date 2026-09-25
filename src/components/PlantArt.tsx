import { useMemo } from "react";
import type { StageKey } from "../../convex/lib/garden";
import { pixelAt, type PixelMap } from "@/world/pixels";
import { keyBedSprite, lookOf, plantSprite, PLANT_SIZE } from "@/world/plants";

/**
 * A plant on its key bed (#129, #55 §G8): our own pixel sprite from `src/world/plants.ts`, the same
 * drawing as the plants on the map, shown at a whole-number scale of 32 × 32 with hard edges. Dormant
 * plants turn autumn and stop blossoming; fruit and golden leaves from Super kudos (#98) show on it.
 * Never a hedgehog: PostHog's hoggies load from PostHog's servers (`lib/art.ts`).
 */

/** One rect per run of same-coloured pixels in a row: a few hundred at most, however big it's drawn. */
function runs(m: PixelMap) {
  const out: { x: number; y: number; w: number; fill: string }[] = [];
  m.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const fill = pixelAt(m, x, y);
      let end = x + 1;
      while (end < row.length && pixelAt(m, end, y) === fill) end++;
      if (fill) out.push({ x, y, w: end - x, fill });
      x = end;
    }
  });
  return out;
}

const TREES: StageKey[] = ["young", "grown", "blossoming", "ancient"];

/** An empty key bed, bare soil, the size a plant would be drawn at. */
export function EmptyBedArt({ size = 112 }: { size?: number }) {
  const bed = keyBedSprite({ sign: false });
  const pixels = runs({ ...bed, rows: [...Array<string>(PLANT_SIZE - bed.rows.length).fill(".".repeat(PLANT_SIZE)), ...bed.rows] });
  const px = PLANT_SIZE * Math.max(1, Math.floor(size / PLANT_SIZE));
  return (
    <svg width={px} height={px} viewBox={`0 0 ${PLANT_SIZE} ${PLANT_SIZE}`} shapeRendering="crispEdges" aria-hidden className="shrink-0" data-bed="empty">
      {pixels.map((p) => (
        <rect key={`${p.x},${p.y}`} x={p.x} y={p.y} width={p.w} height={1} fill={p.fill} />
      ))}
    </svg>
  );
}

export function PlantArt({
  stage,
  species = "helpful_oak",
  dormant = false,
  fruit = 0,
  goldenLeaves = 0,
  size = 112,
}: {
  stage: StageKey;
  species?: string;
  dormant?: boolean;
  fruit?: number;
  goldenLeaves?: number;
  /** The most room it may take, in CSS pixels: drawn at the largest whole multiple of 32 that fits (at least 1×). */
  size?: number;
}) {
  const pixels = useMemo(() => runs(plantSprite({ stage, species, dormant, fruit, goldenLeaves })), [stage, species, dormant, fruit, goldenLeaves]);
  const px = PLANT_SIZE * Math.max(1, Math.floor(size / PLANT_SIZE));
  const tree = TREES.includes(stage);
  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${PLANT_SIZE} ${PLANT_SIZE}`}
      shapeRendering="crispEdges"
      role="img"
      aria-hidden
      className="shrink-0"
      data-bed="key"
      data-stage={stage}
      data-species={species}
      data-canopy={tree ? lookOf(species).canopy : undefined}
      data-dormant={dormant ? "true" : "false"}
      data-fruit={tree ? Math.min(fruit, 4) : 0}
      data-golden-leaves={Math.min(goldenLeaves, 3)}
    >
      {pixels.map((p) => (
        <rect key={`${p.x},${p.y}`} x={p.x} y={p.y} width={p.w} height={1} fill={p.fill} />
      ))}
    </svg>
  );
}
