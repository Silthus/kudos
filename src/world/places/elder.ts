import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/**
 * Where the elder hog sits in base camp (#159, plan #152 S4): a round woven mat of reeds, and beside
 * it a crook staff with a small lantern hanging from its hook. The elder hog itself is PostHog's
 * hedgehog, silvered with age, drawn over the mat by the world (never a hedgehog of ours); its window
 * is the tutorial's: the step you're on, one action and why.
 */
export function elderMat() {
  const c = new PixelCanvas(26, 30);
  // The mat: a flat diamond of reeds, a darker weave round its rim.
  c.polygon([[1, 25], [13, 19], [25, 25], [13, 30]], "A");
  c.polygon([[4, 25], [13, 21], [22, 25], [13, 28]], "a");
  for (const x of [7, 11, 15, 19]) c.set(x, 25, "D");
  c.set(9, 23, "D").set(17, 23, "D").set(13, 27, "D");
  // The crook staff, standing behind the mat's right edge, its hook turned in.
  c.rect(22, 4, 1, 22, "b");
  c.rect(22, 3, 3, 1, "b").set(24, 4, "b").set(24, 5, "b");
  // The lantern on the hook, lit.
  c.rect(23, 6, 3, 1, "k").rect(23, 7, 3, 3, "l").set(24, 8, "c").rect(23, 10, 3, 1, "k");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "elder",
  name: "The elder hog",
  footprint: { x: 0, y: 0, w: 1, h: 1 },
  doors: [{ x: 0, y: 1 }],
  sprite: elderMat(),
  // The mat lies on the tile the elder sits on, and the elder's name tag over its head names the place.
  nameTag: true,
};
