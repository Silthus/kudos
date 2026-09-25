import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/** The sandbox: a low wooden frame of sand with a bucket and a spade, the Slack playground. */
function sandbox() {
  const c = new PixelCanvas(40, 30);
  const box = c.isoBox(2, 2, 4, { left: "s", right: "b", top: "P" }, 29, 4);
  // Sand, a little uneven.
  for (let y = 0; y < 30; y++) for (let x = 0; x < 40; x++) if (c.get(x, y) === "P" && (x * 7 + y * 3) % 11 === 0) c.set(x, y, "p");
  const [cx, cy] = [box.B[0], (box.T[1] + box.B[1]) / 2];
  // The bucket, and the spade stuck in the sand.
  c.rect(cx - 9, cy - 5, 6, 6, "e").rect(cx - 9, cy - 5, 6, 1, "E").rect(cx - 8, cy - 7, 4, 1, "k");
  c.rect(cx + 5, cy - 9, 1, 8, "b").rect(cx + 4, cy - 2, 3, 3, "m");
  c.polygon([[cx - 2, cy + 3], [cx + 2, cy + 1], [cx + 5, cy + 3], [cx + 1, cy + 5]], "s"); // a little sandcastle
  c.rect(cx, cy - 1, 2, 3, "P");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "playground",
  name: "The sandbox",
  footprint: { x: 31, y: 15, w: 2, h: 2 },
  doors: [{ x: 32, y: 17 }],
  sprite: sandbox(),
};
