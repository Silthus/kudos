import { describe, expect, test } from "vitest";
import { CHUNK, DESERT_GROUNDS, TOWN_RADIUS, chunkOf, clearDesertCache, desertAt, desertChunk, desertWalkable, type DesertGround } from "./desert";

/**
 * The desert (#156, #152 §S1): terrain drawn on every client from the workspace's `worldSeed`, in
 * chunks of 32 × 32 tiles, identical for everyone and every visit.
 */

const count = (seed: number, x0: number, y0: number, size: number) => {
  const seen: Partial<Record<DesertGround, number>> = {};
  for (let y = y0; y < y0 + size; y++) for (let x = x0; x < x0 + size; x++) seen[desertAt(seed, x, y)] = (seen[desertAt(seed, x, y)] ?? 0) + 1;
  return seen;
};

describe("the desert", () => {
  test("is the same for a seed however it's asked for: by tile or by chunk, cached or not, in any order", () => {
    const a = desertChunk(7, 3, -2);
    clearDesertCache();
    // Asked for from the far side first, then tile by tile.
    desertChunk(7, 4, -2);
    const tiles = Array.from({ length: CHUNK * CHUNK }, (_, i) => desertAt(7, 3 * CHUNK + (i % CHUNK), -2 * CHUNK + Math.floor(i / CHUNK)));
    expect(tiles).toEqual([...a.ground].map((g) => DESERT_GROUNDS[g]));
    clearDesertCache();
    expect([...desertChunk(7, 3, -2).ground]).toEqual([...a.ground]);
  });

  test("differs from one workspace's seed to another's", () => {
    expect([...desertChunk(1, 2, 2).ground]).not.toEqual([...desertChunk(2, 2, 2).ground]);
  });

  test("chunks tile the plane, negative coordinates too", () => {
    expect(chunkOf({ x: 0, y: 0 })).toEqual({ cx: 0, cy: 0 });
    expect(chunkOf({ x: 31, y: 32 })).toEqual({ cx: 0, cy: 1 });
    expect(chunkOf({ x: -1, y: -33 })).toEqual({ cx: -1, cy: -2 });
  });

  test("has dunes, rock and oases with water out in the sand", () => {
    const seen = count(42, -150, -150, 300);
    for (const ground of ["sand", "dune", "ridge", "rock", "water", "oasis"] as const) expect(seen[ground] ?? 0, ground).toBeGreaterThan(20);
    // Mostly sand and dunes, a little rock, a few oases.
    expect((seen.sand ?? 0) + (seen.dune ?? 0) + (seen.ridge ?? 0)).toBeGreaterThan(300 * 300 * 0.75);
    expect(seen.rock ?? 0).toBeLessThan(300 * 300 * 0.12);
  });

  test("keeps the tree's town clear: no rock, water or oasis near the origin, whatever the seed", () => {
    for (const seed of [0, 1, 99, 4_000_000_000]) {
      for (let y = -TOWN_RADIUS; y <= TOWN_RADIUS; y++)
        for (let x = -TOWN_RADIUS; x <= TOWN_RADIUS; x++) {
          if (Math.hypot(x, y) > TOWN_RADIUS) continue;
          expect(["sand", "dune", "ridge"], `${seed} at ${x},${y}`).toContain(desertAt(seed, x, y));
        }
    }
  });

  test("you can walk everywhere but rock and water", () => {
    expect(desertWalkable("sand")).toBe(true);
    expect(desertWalkable("dune")).toBe(true);
    expect(desertWalkable("ridge")).toBe(true);
    expect(desertWalkable("oasis")).toBe(true);
    expect(desertWalkable("rock")).toBe(false);
    expect(desertWalkable("water")).toBe(false);
  });

  test("an oasis is water ringed by its green bank, so its water is never on the sand's edge", () => {
    for (let y = -150; y < 150; y++)
      for (let x = -150; x < 150; x++) {
        if (desertAt(42, x, y) !== "water") continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) expect(["water", "oasis"], `${x + dx},${y + dy}`).toContain(desertAt(42, x + dx, y + dy));
      }
  });
});
