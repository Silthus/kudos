import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/**
 * The canopy district (#160, opens at the world tree): a rope ladder up to a lookout in the leaves,
 * lanterns strung along its rail. Its window is the tree seen from above at night, every home on
 * the ring lit (`homes.ts canopyScene`).
 */
function lookout() {
  const c = new PixelCanvas(28, 44);
  // The leaves the lookout sits in.
  c.disc(14, 10, 12, "G").disc(13, 9, 10, "g");
  for (const [x, y] of [[7, 5], [15, 3], [19, 9], [8, 12], [12, 7]]) c.rect(x, y, 2, 1, "u");
  // The platform and its rail, lanterns hung along it.
  c.rect(4, 18, 20, 2, "B").rect(4, 20, 20, 1, "b");
  c.rect(4, 14, 1, 4, "b").rect(23, 14, 1, 4, "b").rect(4, 14, 20, 1, "b");
  for (const x of [8, 14, 20]) c.set(x, 15, "b").rect(x, 16, 1, 2, "l");
  // The rope ladder down to the sand.
  c.rect(11, 21, 1, 22, "P").rect(16, 21, 1, 22, "P");
  for (let y = 23; y < 43; y += 3) c.rect(11, y, 6, 1, "s");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "canopy",
  name: "The canopy",
  footprint: { x: 0, y: 0, w: 1, h: 1 },
  doors: [{ x: 0, y: 1 }],
  sprite: lookout(),
};
