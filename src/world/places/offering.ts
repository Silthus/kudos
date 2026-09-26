import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/**
 * The offering stone at the tree's foot (#157, plan #152 S3): a standing stone of sandstone on a
 * low grey plinth, a rune of sap cut down its face, a bowl of lantern-gold coins on the plinth in front
 * and a few seeds scattered round its foot. Givers offer their appreciation here and receivers plant
 * their seeds; its window holds both rituals.
 */
export function offeringStone() {
  const c = new PixelCanvas(30, 38);
  // The plinth: a wide low slab.
  const plinth = c.isoBox(2, 2, 4, { left: "m", right: "M", top: "m" }, 37, 7);
  c.wall(plinth, "left", 0, 2, 16, 1, "M");
  // The standing stone, taller than wide, weathered at its crown.
  c.polygon([[10, 6], [15, 2], [20, 6], [20, 28], [10, 28]], "A");
  c.polygon([[15, 2], [20, 6], [20, 28], [16, 30], [15, 30]], "D");
  c.rect(11, 8, 1, 18, "a");
  // The rune of sap: a sprout cut down its face, glowing.
  c.rect(13, 10, 1, 13, "y");
  c.rect(11, 13, 2, 1, "y").rect(14, 16, 2, 1, "y").rect(11, 19, 2, 1, "y");
  c.set(13, 9, "c").set(12, 12, "y").set(15, 15, "y").set(12, 18, "y");
  // A cracked corner and a lichen spot.
  c.set(19, 9, "k").set(18, 10, "k").set(11, 25, "g").set(12, 25, "G");
  // The bowl of coins on the plinth, in front.
  c.rect(4, 27, 7, 2, "b").rect(5, 29, 5, 1, "b");
  c.rect(5, 25, 5, 2, "l").set(6, 24, "l").set(8, 24, "l").set(7, 25, "c");
  // Seeds at its foot.
  c.set(22, 31, "s").set(24, 30, "s").set(21, 29, "b");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "offering",
  name: "The offering stone",
  footprint: { x: 0, y: 0, w: 1, h: 1 },
  doors: [{ x: 0, y: 1 }],
  sprite: offeringStone(),
};
