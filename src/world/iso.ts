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

/** What the walker needs to know about a map: its size and where you can stand. */
export type Grid = {
  width: number;
  height: number;
  walkable: (x: number, y: number) => boolean;
  /** What stepping onto a tile costs (a small whole number); 1 everywhere when absent. */
  cost?: (x: number, y: number) => number;
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

const inside = (grid: Grid, { x, y }: Tile) => x >= 0 && y >= 0 && x < grid.width && y < grid.height;

/**
 * The cheapest walk from one tile to another over walkable tiles, one grid step at a time: BFS on
 * a plain grid, Dijkstra (with a bucket queue, as costs are small whole numbers) where tiles cost
 * differently, so the hedgehog keeps to the paths. The start is left out, so `[]` means you're
 * there; null when there's no way.
 */
export function findPath(grid: Grid, from: Tile, to: Tile): Tile[] | null {
  if (sameTile(from, to)) return [];
  if (!inside(grid, to) || !grid.walkable(to.x, to.y)) return null;
  const cost = grid.cost ?? (() => 1);
  const key = (t: Tile) => t.y * grid.width + t.x;
  const best = new Map<number, number>([[key(from), 0]]);
  const came = new Map<number, Tile>();
  const buckets: Tile[][] = [[from]];
  for (let d = 0; d < buckets.length; d++) {
    for (const here of buckets[d] ?? []) {
      if (best.get(key(here)) !== d) continue; // a cheaper way here was found later
      if (sameTile(here, to)) {
        const path: Tile[] = [];
        for (let t: Tile | undefined = here; t && !sameTile(t, from); t = came.get(key(t))) path.push(t);
        return path.reverse();
      }
      for (const n of NEIGHBOURS) {
        const next = { x: here.x + n.x, y: here.y + n.y };
        if (!inside(grid, next) || !grid.walkable(next.x, next.y)) continue;
        const total = d + Math.max(1, cost(next.x, next.y));
        if (total >= (best.get(key(next)) ?? Infinity)) continue;
        best.set(key(next), total);
        came.set(key(next), here);
        (buckets[total] ??= []).push(next);
      }
    }
  }
  return null;
}

/** Every tile a walk can reach from a start (for the map's connectivity guard). */
export function reachable(grid: Grid, from: Tile): Set<string> {
  const seen = new Set([`${from.x},${from.y}`]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    for (const d of NEIGHBOURS) {
      const next = { x: queue[i].x + d.x, y: queue[i].y + d.y };
      const id = `${next.x},${next.y}`;
      if (!inside(grid, next) || seen.has(id) || !grid.walkable(next.x, next.y)) continue;
      seen.add(id);
      queue.push(next);
    }
  }
  return seen;
}
