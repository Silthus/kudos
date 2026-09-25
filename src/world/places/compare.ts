import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/**
 * The mirror pond: the water itself is the map's (the footprint floods), this is what's on and
 * round it: rim stones, reeds, lily pads and the moon's reflection.
 */
function pondDressing() {
  const c = new PixelCanvas(62, 44);
  // The footprint diamond (4 × 3 tiles): its left, bottom and right corners on this canvas.
  const R = [59, 31];
  const B = [35, 43];
  const L = [3, 27];
  const along = (a: number[], b: number[], t: number) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t)];
  // Rim stones along the two front edges.
  for (let t = 0.04; t < 1; t += 0.12) {
    const [x1, y1] = along(L, B, t);
    const [x2, y2] = along(B, R, t);
    c.rect(x1 - 1, y1 - 2, 3, 2, "m").set(x1 - 1, y1 - 1, "M");
    c.rect(x2 - 1, y2 - 2, 3, 2, "m").set(x2 + 1, y2 - 1, "M");
  }
  // The moon on the water.
  c.disc(31, 28, 3.5, "p").disc(32, 27, 2, "c");
  // Lily pads, one with a flower.
  c.rect(16, 26, 4, 2, "u").set(18, 26, "g").rect(44, 30, 4, 2, "u").rect(40, 24, 3, 2, "u").set(41, 23, "c");
  // Reeds in the back corners.
  for (const [x, h] of [[6, 10], [8, 13], [10, 8], [52, 9], [54, 12], [56, 7]] as const) {
    const base = x < 30 ? 27 : 31;
    c.rect(x, base - h, 1, h, "G").rect(x, base - h, 1, 3, "s");
  }
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "compare",
  name: "Mirror pond",
  footprint: { x: 31, y: 8, w: 4, h: 3 },
  doors: [{ x: 30, y: 10 }],
  terrain: "water",
  sprite: pondDressing(),
};
