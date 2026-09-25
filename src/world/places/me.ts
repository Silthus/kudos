import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/** Your cabin: a small log cabin with a red roof, a lit window and a lantern by the door. */
function cabin() {
  const c = new PixelCanvas(38, 44);
  const box = c.isoBox(2, 2, 12, { left: "s", right: "b", top: "E" }, 43, 3);
  // Log courses on both walls.
  for (const v of [3, 6, 9]) {
    c.wall(box, "left", 0, v, 16, 1, "b");
    c.wall(box, "right", 0, v, 16, 1, "k");
  }
  // The lit window on the left wall, and the door (with its lantern) on the right, where you come in.
  c.wall(box, "left", 4, 4, 6, 5, "b").wall(box, "left", 5, 5, 4, 3, "l");
  c.wall(box, "right", 4, 0, 5, 9, "k").wall(box, "right", 5, 0, 3, 8, "s").wall(box, "right", 7, 4, 1, 1, "l");
  c.wall(box, "right", 11, 7, 2, 3, "l");
  const eave = { ...box, T: [box.T[0], box.T[1] - 1] as [number, number], R: [box.R[0] + 2, box.R[1]] as [number, number], B: [box.B[0], box.B[1] + 2] as [number, number], L: [box.L[0] - 2, box.L[1]] as [number, number] };
  c.hipRoof(eave, 11, { front: "E", side: "e", back: "E" });
  // A stone chimney with a spark.
  c.rect(24, 4, 3, 7, "M").rect(24, 4, 1, 7, "m").set(25, 2, "l");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "me",
  name: "Your cabin",
  footprint: { x: 6, y: 18, w: 2, h: 2 },
  doors: [{ x: 8, y: 19 }],
  sprite: cabin(),
};
