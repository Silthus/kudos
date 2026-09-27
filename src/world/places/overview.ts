import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/**
 * The overview (#163, opens at the elder stage): a stone plinth with the tree's map unrolled on it,
 * weighted at the corners, and a brass spyglass on a tripod beside it. Its window is the whole tree
 * and its desert from above (`pages/Overview.tsx`).
 */
function mapTable() {
  const c = new PixelCanvas(40, 36);
  // The plinth: a squat block of stone, lit on the left.
  c.rect(8, 20, 20, 14, "m").rect(20, 20, 8, 14, "M");
  c.rect(6, 32, 24, 3, "M").rect(6, 32, 12, 1, "m");
  for (const y of [24, 28]) c.rect(8, y, 20, 1, "M");
  // The map on top, curling at its ends, with the tree and its rings drawn on it.
  c.polygon([[4, 20], [10, 14], [32, 14], [26, 20]], "p");
  c.polygon([[4, 20], [26, 20], [26, 21], [4, 21]], "P");
  c.rect(3, 19, 2, 2, "P").rect(31, 13, 2, 2, "P");
  c.set(17, 17, "y").set(18, 17, "g").set(17, 16, "g").set(18, 18, "B");
  for (const [x, y] of [[13, 17], [22, 16], [15, 15], [24, 18], [12, 19], [27, 15]]) c.set(x, y, "D");
  c.set(20, 19, "l").set(11, 16, "l");
  // Stones holding its corners down.
  c.rect(6, 18, 2, 2, "M").rect(28, 14, 2, 1, "M");
  // The spyglass on its tripod, looking out over the sand.
  c.rect(33, 16, 1, 18, "b").polygon([[33, 22], [30, 34], [31, 34], [33, 25]], "b").polygon([[34, 22], [37, 34], [38, 34], [34, 25]], "b");
  c.polygon([[29, 8], [39, 3], [40, 5], [30, 11]], "l").polygon([[29, 10], [39, 5], [40, 5], [30, 11]], "e");
  c.rect(32, 13, 3, 3, "E");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "overview",
  name: "The overview",
  footprint: { x: 0, y: 0, w: 1, h: 1 },
  doors: [{ x: 0, y: 1 }],
  sprite: mapTable(),
};
