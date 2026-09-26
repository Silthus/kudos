import type { FruitId } from "../../convex/lib/fruits";
import { PixelArt } from "./PixelArt";
import type { PixelMap } from "./pixels";

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
  return (
    <span data-fruit-art={fruit} className="inline-flex shrink-0">
      <PixelArt map={FRUIT_ART[fruit]} width={size} height={size} />
    </span>
  );
}
