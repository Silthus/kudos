import type { Tile } from "./iso";

/**
 * The desert (#152 §S1, #156): the ground of a workspace's world, drawn on the client from its
 * `worldSeed` so everyone sees the same sand without the server sending a tile. It's generated in
 * chunks of 32 × 32 tiles and cached per chunk; a tile is a pure function of the seed and where it
 * is, so a chunk never depends on which chunks were asked for before it.
 *
 * Out in the sand there are dunes (a light crest and its shadowed ridge), outcrops of rock and now
 * and then an oasis: water in a green bank. Within `TOWN_RADIUS` of the tree the desert is plain
 * sand and dunes, so the districts the tree opens never stand on rock or in water. Only the
 * structures are server state; `world.ts` lays them over this.
 */

export const CHUNK = 32;
/** Around the tree the desert keeps clear: no rock, water or oasis within this many tiles. */
export const TOWN_RADIUS = 34;

export const DESERT_GROUNDS = ["sand", "dune", "ridge", "rock", "water", "oasis"] as const;
export type DesertGround = (typeof DESERT_GROUNDS)[number];

/** Whether you can stand on a tile of the desert (any other ground passes too). */
export function desertWalkable(ground: string) {
  return ground !== "rock" && ground !== "water";
}

/** A steady pseudo-random number in [0, 1) for a tile, a seed and a salt. */
export function noise(seed: number, x: number, y: number, salt = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((seed ^ (salt * 0x9e3779b9)) | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise: `noise` on a lattice `cell` tiles apart, blended smoothly in between. */
function valueNoise(seed: number, x: number, y: number, cellX: number, cellY: number, salt: number) {
  const gx = Math.floor(x / cellX);
  const gy = Math.floor(y / cellY);
  const fx = smooth(x / cellX - gx);
  const fy = smooth(y / cellY - gy);
  const n = (i: number, j: number) => noise(seed, gx + i, gy + j, salt);
  const top = n(0, 0) + (n(1, 0) - n(0, 0)) * fx;
  const bottom = n(0, 1) + (n(1, 1) - n(0, 1)) * fx;
  return top + (bottom - top) * fy;
}

/** Oases: at most one per 24 × 24 cell of the desert, a third of the cells, never in the town. */
const OASIS_CELL = 24;
type Oasis = { x: number; y: number; r: number };
function oasisIn(seed: number, i: number, j: number): Oasis | null {
  if (noise(seed, i, j, 31) > 0.34) return null;
  const x = i * OASIS_CELL + 5 + Math.floor(noise(seed, i, j, 32) * (OASIS_CELL - 10));
  const y = j * OASIS_CELL + 5 + Math.floor(noise(seed, i, j, 33) * (OASIS_CELL - 10));
  const r = 2.2 + noise(seed, i, j, 34) * 2.4;
  return Math.hypot(x, y) - r - 2 > TOWN_RADIUS ? { x, y, r } : null;
}

/** One tile of the desert, worked out from scratch (`desertAt` reads it through the chunk cache). */
function groundOf(seed: number, x: number, y: number): DesertGround {
  const town = Math.hypot(x, y) <= TOWN_RADIUS;
  if (!town) {
    const ci = Math.floor(x / OASIS_CELL);
    const cj = Math.floor(y / OASIS_CELL);
    for (let j = cj - 1; j <= cj + 1; j++)
      for (let i = ci - 1; i <= ci + 1; i++) {
        const o = oasisIn(seed, i, j);
        if (!o) continue;
        // A little ragged at the rim, so no two oases are the same circle.
        const d = Math.hypot(x - o.x, (y - o.y) * 1.15) + (noise(seed, x, y, 35) - 0.5) * 0.6;
        if (d <= o.r) return "water";
        if (d <= o.r + 2) return "oasis";
      }
    const rock = valueNoise(seed, x, y, 9, 9, 21) * 0.75 + valueNoise(seed, x, y, 3, 3, 22) * 0.25;
    if (rock > 0.74) return "rock";
  }
  // Dunes run in long bands across the wind, a crest with its shadowed ridge behind it.
  const dune = valueNoise(seed, x + y * 0.35, y, 13, 6, 11) * 0.8 + valueNoise(seed, x, y, 4, 4, 12) * 0.2;
  if (dune > 0.68) return "ridge";
  if (dune > 0.56) return "dune";
  return "sand";
}

export type DesertChunk = { cx: number; cy: number; ground: Uint8Array };

/** Chunks kept in memory: a screenful needs about nine; walking far away drops the oldest. */
const CACHE_SIZE = 256;
const cache = new Map<string, DesertChunk>();

export function clearDesertCache() {
  cache.clear();
}

export function chunkOf(t: Tile) {
  return { cx: Math.floor(t.x / CHUNK), cy: Math.floor(t.y / CHUNK) };
}

/** The 32 × 32 tiles of a chunk, row by row, as indexes into `DESERT_GROUNDS`. */
export function desertChunk(seed: number, cx: number, cy: number): DesertChunk {
  const key = `${seed}:${cx},${cy}`;
  const hit = cache.get(key);
  if (hit) {
    // Most recently used last, so the oldest goes first.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const ground = new Uint8Array(CHUNK * CHUNK);
  for (let j = 0; j < CHUNK; j++)
    for (let i = 0; i < CHUNK; i++) ground[j * CHUNK + i] = DESERT_GROUNDS.indexOf(groundOf(seed, cx * CHUNK + i, cy * CHUNK + j));
  const chunk = { cx, cy, ground };
  cache.set(key, chunk);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return chunk;
}

/** The desert's ground at a tile. */
export function desertAt(seed: number, x: number, y: number): DesertGround {
  const { cx, cy } = chunkOf({ x, y });
  return DESERT_GROUNDS[desertChunk(seed, cx, cy).ground[(y - cy * CHUNK) * CHUNK + (x - cx * CHUNK)]];
}
