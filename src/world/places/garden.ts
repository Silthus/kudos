import type { Tile } from "../iso";
import { PixelCanvas } from "../pixels";
import type { PlaceDef, PlaceGround } from "../places";

/**
 * Your garden on the terrace (#129, moved onto the tree's terrace district by #156): a raised lawn
 * 7 × 7 tiles inside a low fence, a gate in the middle of each side, paths crossing at the little
 * square in the middle where you stand to go in, and your key beds on the diagonals round it. The
 * teammates you thank the most have their beds in a ring just outside the fence. All in tiles from
 * the terrace's anchor; `world.ts` puts it where the tree's layout says.
 */
function gateSign() {
  const c = new PixelCanvas(24, 26);
  c.rect(4, 8, 2, 16, "b").rect(18, 8, 2, 16, "b");
  c.rect(2, 6, 20, 9, "p").rect(2, 14, 20, 1, "P").rect(2, 6, 20, 1, "P");
  // A sprout painted on the board.
  c.rect(11, 9, 2, 4, "g").rect(8, 9, 3, 2, "u").rect(13, 8, 3, 2, "u");
  c.set(3, 5, "l").set(20, 5, "l");
  return c.outline().map();
}

/**
 * Your plot tiles in planting order: round the little square first (front, right, left, back),
 * then the outer corners, so a young garden stands together where you come in.
 */
export const PLOTS: Tile[] = [
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
  { x: 2, y: 2 },
  { x: 2, y: -2 },
  { x: -2, y: 2 },
  { x: -2, y: -2 },
];

/** The neighbours' beds just outside the fence, every other tile clear of the gates, the front corner first. */
export const BEDS: Tile[] = (() => {
  const beds: Tile[] = [];
  for (let y = -4; y <= 4; y++)
    for (let x = -4; x <= 4; x++) if (Math.max(Math.abs(x), Math.abs(y)) === 4 && x % 2 === 0 && y % 2 === 0 && x !== 0 && y !== 0) beds.push({ x, y });
  const d = (t: Tile) => Math.abs(t.x - 4) + Math.abs(t.y - 4);
  return beds.sort((a, b) => d(a) - d(b) || a.x - b.x);
})();

/** The terrace's own ground: fence and gates round the edge, the crossing paths, the plots. */
const ground: PlaceGround = (x, y) => {
  const lane = x === 0 || y === 0;
  if (Math.max(Math.abs(x), Math.abs(y)) === 3) return lane ? "gate" : "fence";
  if (lane) return "path";
  return PLOTS.some((p) => p.x === x && p.y === y) ? "plot" : "garden";
};

export const place: PlaceDef = {
  id: "garden",
  name: "Your garden",
  footprint: { x: -3, y: -3, w: 7, h: 7 },
  walkable: true,
  ground,
  doors: [{ x: 0, y: 0 }],
  // By the right-hand gate, clear of you in the middle of the terrace.
  spriteAt: { x: 4, y: 1 },
  spriteOffset: { x: 4, y: 0 },
  sprite: gateSign(),
};
