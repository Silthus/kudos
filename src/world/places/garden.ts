import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/**
 * Your garden, the centre of the world: the raised lawn with its key beds is the map's own
 * (`tiles.ts` lays it out); this is its gate sign. You're in the garden at its heart, the little
 * square where its paths meet.
 */
function gateSign() {
  const c = new PixelCanvas(24, 26);
  c.rect(4, 8, 2, 16, "b").rect(18, 8, 2, 16, "b");
  c.rect(2, 6, 20, 9, "p").rect(2, 14, 20, 1, "P").rect(2, 6, 20, 1, "P");
  // A sprout painted on the board.
  c.rect(11, 9, 2, 4, "g").rect(8, 9, 3, 2, "u").rect(13, 8, 3, 2, "u");
  c.set(3, 5, "l").set(20, 5, "l");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "garden",
  name: "Your garden",
  footprint: { x: 15, y: 9, w: 10, h: 10 },
  walkable: true,
  doors: [
    { x: 19, y: 13 },
    { x: 20, y: 13 },
    { x: 19, y: 14 },
    { x: 20, y: 14 },
  ],
  spriteAt: { x: 21, y: 18 },
  sprite: gateSign(),
};
