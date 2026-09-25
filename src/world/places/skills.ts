import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/** The elder oak: the biggest tree in the world, four branches for the four skill paths. */
function oak() {
  const c = new PixelCanvas(56, 70);
  c.polygon([[4, 57], [28, 45], [52, 57], [28, 69]], "G"); // its shade on the lawn
  // Roots and trunk.
  c.rect(24, 36, 9, 26, "b").rect(24, 36, 3, 26, "s");
  c.rect(20, 58, 5, 3, "b").rect(32, 59, 5, 3, "b");
  // Four branches reaching out into the crown.
  c.polygon([[26, 42], [10, 30], [12, 28], [28, 38]], "b");
  c.polygon([[30, 42], [46, 30], [44, 28], [28, 38]], "b");
  c.polygon([[26, 36], [18, 18], [21, 17], [29, 34]], "b");
  c.polygon([[30, 36], [38, 18], [35, 17], [27, 34]], "b");
  // The crown: dark underneath, lighter leaves where the last light catches them.
  c.disc(28, 26, 17, "G").disc(12, 28, 9, "G").disc(45, 28, 9, "G");
  c.disc(20, 18, 10, "g").disc(36, 18, 10, "g").disc(28, 12, 10, "g").disc(12, 25, 6, "g").disc(44, 25, 6, "g");
  c.disc(22, 13, 4, "u").disc(33, 10, 4, "u").disc(40, 18, 3, "u").disc(14, 21, 3, "u");
  // The branch ends show through the leaves, one lantern-lit bud each.
  for (const [x, y] of [[10, 30], [46, 30], [18, 18], [38, 18]] as const) c.rect(x - 1, y - 1, 3, 3, "b").set(x, y - 2, "l");
  c.rect(24, 36, 9, 2, "G");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "skills",
  name: "The elder oak",
  footprint: { x: 6, y: 12, w: 3, h: 3 },
  doors: [{ x: 9, y: 14 }],
  sprite: oak(),
};
