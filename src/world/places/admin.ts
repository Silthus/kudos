import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/**
 * The gatehouse, where the workspace is run: a crenellated stone gate with a portcullis in its
 * arch, a lantern hanging from an iron bracket beside it (lit: someone is on duty), arrow-slit
 * windows, and the workspace's flag on the tower.
 */
function gatehouse() {
  const c = new PixelCanvas(48, 62);
  const box = c.isoBox(3, 2, 22, { left: "m", right: "M", top: "M" }, 61, 4);
  // A plinth and a course of stone.
  c.wall(box, "left", 0, 0, 24, 2, "M").wall(box, "right", 0, 0, 16, 2, "k");
  c.wall(box, "left", 0, 16, 24, 1, "M").wall(box, "right", 0, 16, 16, 1, "k");
  // Battlements along the two front edges.
  for (let u = 1; u < 24; u += 5) c.wall(box, "left", u, 22, 3, 3, "m");
  for (let u = 1; u < 16; u += 5) c.wall(box, "right", u, 22, 3, 3, "M");
  // The gate arch on the long wall, where you come in: a keystone, the portcullis half raised.
  c.wall(box, "left", 7, 2, 10, 13, "k").wall(box, "left", 8, 2, 8, 12, "b").wall(box, "left", 11, 15, 2, 1, "P");
  for (const u of [9, 11, 13, 15]) c.wall(box, "left", u, 6, 1, 8, "k");
  c.wall(box, "left", 8, 9, 8, 1, "k").wall(box, "left", 8, 13, 8, 1, "k");
  for (const u of [9, 11, 13, 15]) c.wall(box, "left", u, 5, 1, 1, "M"); // the portcullis' spikes
  // The lantern: an iron bracket out from the wall, the lamp hanging lit below it.
  c.wall(box, "left", 3, 14, 4, 1, "k").wall(box, "left", 3, 11, 1, 3, "k");
  c.wall(box, "left", 2, 7, 3, 4, "l").wall(box, "left", 3, 8, 1, 2, "c").wall(box, "left", 2, 11, 3, 1, "b").wall(box, "left", 2, 6, 3, 1, "b");
  // Arrow slits.
  c.wall(box, "left", 20, 8, 1, 5, "k").wall(box, "right", 5, 8, 1, 5, "k").wall(box, "right", 11, 8, 1, 5, "k");
  c.wall(box, "right", 5, 18, 2, 3, "l");
  // The flag on the tower.
  c.rect(box.T[0], box.T[1] - 15, 1, 17, "b").set(box.T[0], box.T[1] - 16, "l");
  c.rect(box.T[0] + 1, box.T[1] - 15, 7, 4, "e").rect(box.T[0] + 1, box.T[1] - 12, 7, 1, "E").rect(box.T[0] + 3, box.T[1] - 14, 2, 2, "l");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "admin",
  name: "The gatehouse",
  footprint: { x: 22, y: 1, w: 3, h: 2 },
  doors: [{ x: 24, y: 3 }],
  sprite: gatehouse(),
};
