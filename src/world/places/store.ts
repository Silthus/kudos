import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/** The store stall: a market counter under a striped awning, goods on display. */
function stall() {
  const c = new PixelCanvas(40, 46);
  const counter = c.isoBox(2, 2, 8, { left: "P", right: "s", top: "p" }, 45, 4);
  c.wall(counter, "left", 0, 6, 16, 2, "s").wall(counter, "right", 0, 6, 16, 2, "b");
  // Goods: lantern fruit and leafy bundles on the counter.
  c.disc(12, 23, 2, "l").disc(17, 25, 2, "e").disc(22, 24, 2, "u").disc(26, 22, 2, "l").disc(20, 20, 2, "g");
  // Four posts up to the awning.
  for (const [x, y] of [[4, 15], [19, 22], [34, 15], [19, 8]] as const) c.rect(x, y - 13, 2, 14, "b");
  const awning = c.isoBox(2.25, 2.25, 3, { left: "e", right: "e", top: "e" }, 26, 2);
  c.hipRoof({ ...awning, T: [awning.T[0], awning.T[1]] }, 6, { front: "e", side: "e", back: "E" });
  // Stripes: every other 3 px column of the awning in parchment.
  for (let y = 0; y < 28; y++) for (let x = 0; x < 40; x++) if (c.get(x, y) === "e" && Math.floor(x / 3) % 2 === 0) c.set(x, y, "p");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "store",
  name: "The store stall",
  footprint: { x: 13, y: 24, w: 2, h: 2 },
  doors: [{ x: 15, y: 25 }],
  sprite: stall(),
};
