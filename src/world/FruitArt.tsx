import { useMemo } from "react";
import type { FruitId } from "../../convex/lib/fruits";
import { pixelRuns, type PixelMap } from "./pixels";

/**
 * Tree fruit (#157, lib/fruits.ts) in our own pixels, 10 × 10 on a stem: the sun fruit round and gold,
 * the moon fruit a pale crescent, amber a honey drop, the star fruit violet, the heart fruit ember.
 * Drawn wherever fruit shows: the stone's ledger, the cabin's shelf and the stall.
 */
export const FRUIT_ART: Record<FruitId, PixelMap> = {
  sun: {
    rows: [
      "....bG....",
      "....bG....",
      "..kkkkkk..",
      ".klllllck.",
      "kllllllclk",
      "klllllllek",
      "klllllleek",
      "kllllleeek",
      ".keeeeeek.",
      "..kkkkkk..",
    ],
  },
  moon: {
    rows: [
      "....bG....",
      "...kkkk...",
      "..kcccck..",
      ".kccmkk...",
      ".kcck.....",
      ".kcck.....",
      ".kccmkk...",
      "..kcccck..",
      "...kkkk...",
      "..........",
    ],
  },
  amber: {
    rows: [
      "....bG....",
      "....kk....",
      "...kllk...",
      "..kllclk..",
      "..klllck..",
      ".klllllek.",
      ".kllllleek",
      ".kleeeeeek",
      "..keeeeek.",
      "...kkkkk..",
    ],
  },
  star: {
    rows: [
      "....bG....",
      "....kk....",
      "...kvvk...",
      "kkkkvvkkkk",
      "kvvvvcvvvk",
      ".kvvvvvvk.",
      "..kvvvvk..",
      ".kvvkkvvk.",
      ".kvk..kvk.",
      ".kk....kk.",
    ],
  },
  heart: {
    rows: [
      "....bG....",
      ".kkkbkkk..",
      "keeckeeek.",
      "keceeeeek.",
      "keeeeeeek.",
      ".keeeeEk..",
      "..keeEk...",
      "...kEk....",
      "....k.....",
      "..........",
    ],
  },
};

export function FruitArt({ fruit, size = 24 }: { fruit: FruitId; size?: number }) {
  const runs = useMemo(() => pixelRuns(FRUIT_ART[fruit]), [fruit]);
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden className="shrink-0" data-fruit-art={fruit}>
      {runs.map((p) => (
        <rect key={`${p.x},${p.y}`} x={p.x} y={p.y} width={p.w} height={1} fill={p.fill} />
      ))}
    </svg>
  );
}
