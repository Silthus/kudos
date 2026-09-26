import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

type Pt = [number, number];

/**
 * Your cabin: a log cabin under a gabled red roof. The big window on the left wall is lit, the door
 * with its lantern is under the gable on the right wall, where you come in, and a stone chimney
 * stands behind the ridge.
 */
function cabin() {
  const c = new PixelCanvas(40, 48);
  const box = c.isoBox(2, 2, 13, { left: "s", right: "b", top: "b" }, 47, 4);
  // Log courses: a dark seam every third row, and the log ends where the walls meet.
  for (const v of [3, 6, 9, 12]) {
    c.wall(box, "left", 0, v, 16, 1, "b");
    c.wall(box, "right", 0, v, 16, 1, "k");
  }
  for (const v of [1, 4, 7, 10]) c.wall(box, "left", 0, v, 1, 1, "P");

  // The lit window: a bark frame, lantern panes, a cross of glazing bars and a parchment sill.
  c.wall(box, "left", 3, 3, 9, 8, "b");
  c.wall(box, "left", 4, 4, 7, 6, "l");
  c.wall(box, "left", 7, 4, 1, 6, "b").wall(box, "left", 4, 6, 7, 1, "b");
  c.wall(box, "left", 4, 9, 3, 1, "c"); // the warm glint in the top pane
  c.wall(box, "left", 2, 2, 11, 1, "P");

  // The door under the gable, with a lantern beside it.
  c.wall(box, "right", 3, 0, 6, 10, "k").wall(box, "right", 4, 0, 4, 9, "s").wall(box, "right", 5, 0, 1, 8, "E");
  c.wall(box, "right", 7, 4, 1, 1, "l");
  c.wall(box, "right", 11, 6, 2, 3, "l").wall(box, "right", 11, 9, 2, 1, "k");

  // A gabled roof, its ridge running along the left wall, so the gable end faces the door.
  const [T, R, B, L] = [box.T, box.R, box.B, box.L];
  const rise = 11;
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const back = mid(L, T);
  const front = mid(B, R);
  const ridgeBack: Pt = [back[0], back[1] - rise];
  const ridgeFront: Pt = [front[0], front[1] - rise];
  c.polygon([T, R, ridgeFront, ridgeBack], "E"); // the back slope
  // The chimney rises behind the ridge.
  c.rect(24, 9, 4, 9, "M").rect(24, 9, 1, 9, "m").rect(23, 8, 6, 1, "M");
  // The gable over the door, planked in bark with a round attic light.
  c.polygon([B, R, ridgeFront], "b");
  c.rect(front[0] - 1, front[1] - 6, 2, 2, "l");
  // The front slope with its eave overhanging the left wall; a lantern-lit ridge line.
  const eaveL: Pt = [L[0] - 2, L[1] + 1];
  const eaveB: Pt = [B[0], B[1] + 2];
  c.polygon([eaveL, eaveB, [ridgeFront[0], ridgeFront[1] + 1], ridgeBack], "e");
  for (let i = 0; i <= 16; i++) c.set(Math.round(ridgeBack[0] + i), Math.round(ridgeBack[1] + i / 2), "E");
  // Shingle courses across the front slope, parallel to the eave.
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (c.get(x, y) === "e" && Math.floor(y - x / 2) % 3 === 0) c.set(x, y, "E");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "me",
  name: "Your cabin",
  footprint: { x: 6, y: 18, w: 2, h: 2 },
  doors: [{ x: 8, y: 19 }],
  sprite: cabin(),
};
