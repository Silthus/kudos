import { PixelCanvas } from "../pixels";
import type { PlaceDef } from "../places";

/** The four branches, as (where the branch leaves the trunk, where its leaves are). */
const BRANCHES: { from: [number, number]; to: [number, number]; r: number }[] = [
  { from: [27, 47], to: [10, 30], r: 9 }, // Gardener, low on the left
  { from: [29, 41], to: [19, 15], r: 10 }, // Herald, high on the left
  { from: [31, 41], to: [41, 15], r: 10 }, // Scout, high on the right
  { from: [33, 47], to: [50, 30], r: 9 }, // Neighbour, low on the right
];

/**
 * The elder oak: the biggest tree in the world, a thick trunk that splits into four branches, one
 * for each skill path, each ending in its own crown of leaves with a few lit buds (the skills you
 * took). The crowns leave the middle open, so the four branches read from across the map.
 */
function oak() {
  const c = new PixelCanvas(60, 74);
  c.polygon([[5, 63], [30, 51], [55, 63], [30, 73]], "G"); // its shade on the lawn
  // The trunk, flaring into roots.
  c.polygon([[21, 65], [26, 56], [34, 56], [39, 65]], "b");
  c.rect(26, 36, 8, 26, "b").rect(26, 36, 2, 26, "s").rect(24, 58, 2, 5, "s");
  c.rect(30, 44, 1, 3, "k").rect(29, 52, 1, 2, "k"); // bark cracks
  // Four branches, 3 px thick, from the trunk out to their crowns.
  for (const { from, to } of BRANCHES) {
    const [fx, fy] = from;
    const [tx, ty] = to;
    const len = Math.hypot(tx - fx, ty - fy);
    const [nx, ny] = [(-(ty - fy) / len) * 1.6, ((tx - fx) / len) * 1.6];
    c.polygon([[fx - nx, fy - ny], [fx + nx, fy + ny], [tx + nx, ty + ny], [tx - nx, ty - ny]], "b");
  }
  // Each crown: dark underneath, the last light on its upper left, lit buds among the leaves.
  for (const { to, r } of BRANCHES) {
    const [x, y] = to;
    c.disc(x, y, r, "G").disc(x - 1, y - 1.5, r - 2, "g").disc(x - 3, y - 4, r / 3, "u");
    c.set(x + 3, y + 1, "l").set(x - 4, y + 3, "l").set(x + 1, y - 3, "l");
  }
  // Where the branches leave the trunk, in front of the crowns.
  c.rect(27, 38, 6, 4, "b").rect(27, 38, 1, 4, "s");
  return c.outline().map();
}

export const place: PlaceDef = {
  id: "skills",
  name: "The elder oak",
  footprint: { x: 6, y: 12, w: 3, h: 3 },
  doors: [{ x: 9, y: 14 }],
  sprite: oak(),
  // Nudged left, clear of the gallery's sign next door on a phone.
  signOffset: { x: -7, y: 0 },
};
