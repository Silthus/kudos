import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/**
 * The blight stone at the tree's foot (#164, plan #152 S8): a jagged slab of dark stone split by
 * veins of blight purple, and at its foot the hollow the blight raid goes down into. The company
 * gathers here while a blight is at the tree; its window holds the meter, the raid and the history.
 */
export function blightStone() {
  const c = new PixelCanvas(32, 40);
  // A cracked grey plinth of fallen stones.
  const plinth = c.isoBox(2, 2, 4, { left: "M", right: "k", top: "M" }, 39, 7);
  c.wall(plinth, "left", 0, 2, 16, 1, "k");
  // The slab: taller than wide, leaning, its crown broken into teeth.
  c.polygon([[9, 9], [12, 3], [14, 6], [17, 1], [19, 5], [22, 4], [23, 10], [22, 31], [10, 31]], "M");
  c.polygon([[17, 1], [19, 5], [22, 4], [23, 10], [22, 31], [17, 33], [16, 33]], "k");
  c.rect(10, 10, 1, 19, "m");
  // Veins of blight running down its face, brightest where they split.
  c.rect(14, 7, 1, 7, "x").rect(13, 13, 1, 5, "x").rect(15, 16, 1, 6, "x").rect(14, 21, 1, 7, "x");
  c.rect(11, 18, 2, 1, "x").rect(16, 11, 3, 1, "x").rect(19, 12, 1, 4, "x").rect(12, 24, 2, 1, "x");
  c.set(14, 13, "v").set(15, 21, "v").set(19, 13, "v");
  // The hollow at its foot: a dark mouth with the blight's glow deep in it.
  c.polygon([[3, 30], [8, 27], [12, 30], [8, 34]], "k");
  c.rect(6, 30, 3, 2, "x").set(7, 30, "v");
  // Withered sprigs round it.
  c.set(25, 33, "D").set(26, 32, "D").set(27, 34, "n").set(1, 35, "D");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "blight",
  name: "The blight stone",
  footprint: { x: 0, y: 0, w: 1, h: 1 },
  doors: [{ x: 0, y: 1 }],
  sprite: blightStone(),
};
