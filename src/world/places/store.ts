import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/**
 * The store stall: a plank counter with goods on it under a striped awning with a scalloped edge,
 * and a gold coin hanging from the front corner, the Store's one currency.
 */
function stall() {
  const c = new PixelCanvas(44, 50);
  const counter = c.isoBox(2, 2, 9, { left: "P", right: "s", top: "p" }, 49, 6);
  // Planks on the counter's front, a dark shelf edge at the top.
  for (const u of [5, 10]) c.wall(counter, "left", u, 0, 1, 8, "m");
  c.wall(counter, "left", 0, 7, 16, 1, "s").wall(counter, "right", 0, 7, 16, 1, "b");
  // Goods on the counter: lantern fruit, a red jar, leafy bundles, a stack of coins.
  c.disc(14, 34, 2, "l").disc(19, 36, 2, "e").rect(23, 33, 3, 3, "u").set(24, 32, "g").disc(29, 34, 2, "l").rect(20, 32, 3, 2, "l").rect(20, 31, 3, 1, "c");
  // Posts at the counter's corners up to the awning (the back one hides behind the goods).
  const top = counter.T[1];
  for (const [x, y] of [counter.L, counter.B, counter.R] as const) c.rect(x - (x > 22 ? 1 : 0), top - 10, 1, y - top + 10, "b");
  c.rect(counter.T[0], top - 10, 1, 10, "k");
  // The awning: a shallow striped roof a little wider than the counter, a scalloped front edge.
  const awning = c.isoBox(2.4, 2.4, 2, { left: "e", right: "E", top: "e" }, 30, 3.8);
  const apex = c.hipRoof(awning, 5, { front: "e", side: "e", back: "E" });
  for (let y = 0; y < 31; y++)
    for (let x = 0; x < 44; x++) {
      const ch = c.get(x, y);
      if ((ch === "e" || ch === "E") && Math.floor(x / 3) % 2 === 0) c.set(x, y, ch === "e" ? "p" : "P");
    }
  for (let x = Math.ceil(awning.L[0]); x <= awning.R[0]; x++) {
    if (x % 3 === 2) continue;
    const onLeft = x <= awning.B[0];
    const y = onLeft ? awning.L[1] + awning.height + (x - awning.L[0]) / 2 : awning.B[1] + awning.height - (x - awning.B[0]) / 2;
    c.set(x, Math.round(y) + 1, Math.floor(x / 3) % 2 === 0 ? "p" : "e");
  }
  // A gold coin on a short pole on top, the Store's one currency.
  const [ax, ay] = [Math.round(apex[0]), Math.round(apex[1])];
  c.rect(ax, ay - 3, 1, 3, "b").disc(ax + 0.5, ay - 5.5, 2.5, "l").set(ax - 1, ay - 7, "c").rect(ax, ay - 6, 1, 2, "s");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "store",
  name: "The store stall",
  footprint: { x: 12, y: 24, w: 2, h: 2 },
  doors: [{ x: 14, y: 25 }],
  sprite: stall(),
  // One tile west of where #128 put it, so the hedgehog at the door leaves the signpost's sign in
  // view; the sign hangs in front of the stall, clear of the cabin's doorstep above it (#128).
  signOffset: { x: 8, y: 62 },
};
