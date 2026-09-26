/**
 * The world's geometry (#126, #128): 2:1 isometric tiles, tile ↔ screen math, key steps and
 * path finding. Pure, and in art pixels: the canvas scales everything by one integer.
 *
 * Tile (x, y) is a diamond TILE_W wide and TILE_H tall. Tile (0, 0) sits at the top of the map;
 * a step along x goes down-right on screen, a step along y down-left. Screen coordinates here are
 * relative to the map's origin, the top corner of tile (0, 0) sitting at x = 0.
 */

export const TILE_W = 16;
export const TILE_H = 8;

export type Tile = { x: number; y: number };
export type Point = { x: number; y: number };

/** What the walker needs to know about a map: where you can stand, and optionally where it ends. */
export type Grid = {
  walkable: (x: number, y: number) => boolean;
  /** What stepping onto a tile costs (a small whole number); 1 everywhere when absent. */
  cost?: (x: number, y: number) => number;
  /** The tiles a walk keeps within (inclusive); the plane goes on for ever when absent (#156). */
  bounds?: { x0: number; y0: number; x1: number; y1: number };
};

/** The centre of a tile's diamond. */
export function tileCentre({ x, y }: Tile): Point {
  return { x: ((x - y) * TILE_W) / 2, y: ((x + y + 1) * TILE_H) / 2 };
}

/** The tile whose diamond holds a screen point. */
export function tileAt({ x, y }: Point): Tile {
  const u = x / (TILE_W / 2); // x − y
  const v = y / (TILE_H / 2) - 1; // x + y, from the centre line
  // `+ 0` turns a -0 from rounding into 0.
  return { x: Math.round((u + v) / 2) + 0, y: Math.round((v - u) / 2) + 0 };
}

export const sameTile = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y;

const KEY_STEPS: Record<string, Tile> = {
  arrowup: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  arrowright: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
  arrowdown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  arrowleft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
};

/**
 * The step a key takes: one tile along the grid. Each key heads to its own side of the screen
 * (up goes up-right, right goes down-right, down goes down-left, left goes up-left), so every
 * tile stays reachable with single keys.
 */
export function stepFor(key: string): Tile | null {
  return KEY_STEPS[key.toLowerCase()] ?? null;
}

const NEIGHBOURS: Tile[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const inside = (grid: Grid, { x, y }: Tile) => !grid.bounds || (x >= grid.bounds.x0 && y >= grid.bounds.y0 && x <= grid.bounds.x1 && y <= grid.bounds.y1);
/** One number per tile, negative tiles too: good for a million tiles either way. */
const tileKey = (t: Tile) => (t.x + 1_048_576) * 2_097_152 + (t.y + 1_048_576);

/** A walk gives up after looking at this many tiles: the desert has no end to search to. */
export const SEARCH_LIMIT = 150_000;

/**
 * The cheapest walk from one tile to another over walkable tiles, one grid step at a time: A* with
 * a bucket queue (costs are small whole numbers, at least 1, so the straight-line grid distance
 * never overestimates), so the hedgehog keeps to the paths and a walk across the endless desert
 * only looks where it's heading. The start is left out, so `[]` means you're there; null when
 * there's no way (or none within `SEARCH_LIMIT` tiles looked at).
 */
export function findPath(grid: Grid, from: Tile, to: Tile): Tile[] | null {
  if (sameTile(from, to)) return [];
  if (!inside(grid, to) || !grid.walkable(to.x, to.y)) return null;
  const cost = grid.cost ?? (() => 1);
  const h = (t: Tile) => Math.abs(t.x - to.x) + Math.abs(t.y - to.y);
  const best = new Map<number, number>([[tileKey(from), 0]]);
  const came = new Map<number, Tile>();
  const buckets: Tile[][] = [];
  buckets[h(from)] = [from];
  let looked = 0;
  for (let f = h(from); f < buckets.length; f++) {
    const bucket = buckets[f];
    if (!bucket) continue;
    for (let i = 0; i < bucket.length; i++) {
      const here = bucket[i];
      const g = f - h(here);
      if (best.get(tileKey(here)) !== g) continue; // a cheaper way here was found later
      if (sameTile(here, to)) {
        const path: Tile[] = [];
        for (let t: Tile | undefined = here; t && !sameTile(t, from); t = came.get(tileKey(t))) path.push(t);
        return path.reverse();
      }
      if (++looked > SEARCH_LIMIT) return null;
      for (const n of NEIGHBOURS) {
        const next = { x: here.x + n.x, y: here.y + n.y };
        if (!inside(grid, next) || !grid.walkable(next.x, next.y)) continue;
        const total = g + Math.max(1, cost(next.x, next.y));
        const k = tileKey(next);
        if (total >= (best.get(k) ?? Infinity)) continue;
        best.set(k, total);
        came.set(k, here);
        (buckets[total + h(next)] ??= []).push(next);
      }
    }
    buckets[f] = undefined as never;
  }
  return null;
}
