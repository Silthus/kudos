import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/** The gatehouse: a crenellated stone gate with a lantern and a flag, where the workspace is run. */
function gatehouse() {
  const c = new PixelCanvas(46, 58);
  const box = c.isoBox(3, 2, 20, { left: "m", right: "M", top: "M" }, 57, 3);
  // Battlements along the two front edges.
  for (let u = 1; u < 24; u += 5) c.wall(box, "left", u, 20, 3, 3, "m");
  for (let u = 1; u < 16; u += 5) c.wall(box, "right", u, 20, 3, 3, "M");
  // The gate arch on the long wall, where you come in, with its portcullis.
  c.wall(box, "left", 7, 0, 10, 13, "k").wall(box, "left", 8, 0, 8, 12, "b");
  for (const u of [9, 11, 13, 15]) c.wall(box, "left", u, 0, 1, 12, "k");
  c.wall(box, "left", 4, 9, 2, 3, "l"); // the lantern by the gate
  c.wall(box, "right", 6, 10, 2, 4, "l");
  // A flag on the tower.
  c.rect(box.T[0], box.T[1] - 14, 1, 16, "b").rect(box.T[0] + 1, box.T[1] - 14, 6, 4, "e").rect(box.T[0] + 1, box.T[1] - 11, 6, 1, "E");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "admin",
  name: "The gatehouse",
  footprint: { x: 22, y: 1, w: 3, h: 2 },
  doors: [{ x: 24, y: 3 }],
  sprite: gatehouse(),
};
