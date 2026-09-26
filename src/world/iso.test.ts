import { describe, expect, test } from "vitest";
import { TILE_H, TILE_W, findPath, stepFor, tileAt, tileCentre, type Grid } from "./iso";

/** A grid from rows of text: `.` walkable, `#` blocked. */
const grid = (rows: string[]): Grid => ({
  walkable: (x, y) => rows[y]?.[x] === ".",
});

describe("2:1 isometric tiles", () => {
  test("tiles are twice as wide as they are tall", () => {
    expect(TILE_W).toBe(2 * TILE_H);
  });

  test("a step along x goes down-right on screen, a step along y down-left", () => {
    const origin = tileCentre({ x: 0, y: 0 });
    expect(tileCentre({ x: 1, y: 0 })).toEqual({ x: origin.x + TILE_W / 2, y: origin.y + TILE_H / 2 });
    expect(tileCentre({ x: 0, y: 1 })).toEqual({ x: origin.x - TILE_W / 2, y: origin.y + TILE_H / 2 });
  });

  test("a screen point maps back to the tile whose diamond holds it", () => {
    for (const t of [{ x: 0, y: 0 }, { x: 5, y: 3 }, { x: 39, y: 27 }, { x: 12, y: 20 }]) {
      const c = tileCentre(t);
      expect(tileAt(c)).toEqual(t);
      // Just inside each corner of the diamond is still the same tile.
      expect(tileAt({ x: c.x - TILE_W / 2 + 1.5, y: c.y })).toEqual(t);
      expect(tileAt({ x: c.x, y: c.y - TILE_H / 2 + 1 })).toEqual(t);
      expect(tileAt({ x: c.x + TILE_W / 2 - 1.5, y: c.y })).toEqual(t);
    }
  });
});

describe("keys move one tile along the grid, each towards its own side of the screen", () => {
  test.each([
    ["ArrowUp", { x: 0, y: -1 }, "up"],
    ["w", { x: 0, y: -1 }, "up"],
    ["ArrowRight", { x: 1, y: 0 }, "right"],
    ["d", { x: 1, y: 0 }, "right"],
    ["ArrowDown", { x: 0, y: 1 }, "down"],
    ["S", { x: 0, y: 1 }, "down"],
    ["ArrowLeft", { x: -1, y: 0 }, "left"],
    ["a", { x: -1, y: 0 }, "left"],
  ])("%s", (key, step, side) => {
    expect(stepFor(key)).toEqual(step);
    const from = tileCentre({ x: 5, y: 5 });
    const to = tileCentre({ x: 5 + step.x, y: 5 + step.y });
    if (side === "up") expect(to.y).toBeLessThan(from.y);
    if (side === "down") expect(to.y).toBeGreaterThan(from.y);
    if (side === "left") expect(to.x).toBeLessThan(from.x);
    if (side === "right") expect(to.x).toBeGreaterThan(from.x);
  });

  test("other keys don't walk", () => {
    expect(stepFor("Enter")).toBeNull();
    expect(stepFor("q")).toBeNull();
  });
});

describe("path finding", () => {
  const map = grid([
    ".....", //
    ".###.",
    ".#...",
    ".#.#.",
    "...#.",
  ]);

  test("finds a shortest walk round what's in the way, without the start", () => {
    const path = findPath(map, { x: 0, y: 0 }, { x: 2, y: 2 })!;
    expect(path.at(-1)).toEqual({ x: 2, y: 2 });
    expect(path).toHaveLength(8); // along the top, down the right, back in
    for (const [i, t] of path.entries()) {
      const prev = i === 0 ? { x: 0, y: 0 } : path[i - 1];
      expect(Math.abs(t.x - prev.x) + Math.abs(t.y - prev.y)).toBe(1);
      expect(map.walkable(t.x, t.y)).toBe(true);
    }
  });

  test("prefers the road: a longer walk along cheap tiles beats a short one across dear ones", () => {
    // `=` is road (cost 1), `.` lawn (cost 4).
    const rows = ["=====", "=...=", "=...=", "=...="];
    const roads: Grid = { ...grid(rows.map((r) => r.replaceAll("=", "."))), cost: (x, y) => (rows[y][x] === "=" ? 1 : 4) };
    const path = findPath(roads, { x: 0, y: 3 }, { x: 4, y: 3 })!;
    expect(path).toHaveLength(10); // up, across the top, down: 10 road steps, not 4 lawn ones
    expect(path.every((t) => rows[t.y][t.x] === "=")).toBe(true);
  });

  test("standing on the goal is an empty walk", () => {
    expect(findPath(map, { x: 4, y: 4 }, { x: 4, y: 4 })).toEqual([]);
  });

  test("no walk to a blocked or walled-off tile, or off the map", () => {
    expect(findPath(map, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
    expect(findPath(grid([".#.", "##.", "..."]), { x: 0, y: 0 }, { x: 2, y: 2 })).toBeNull();
    expect(findPath(map, { x: 0, y: 0 }, { x: 9, y: 0 })).toBeNull();
  });

  test("the plane has no edge: walks cross negative tiles, far out and back (#156)", () => {
    const open: Grid = { walkable: (x, y) => !(x === 0 && y > -50 && y < 50) };
    const path = findPath(open, { x: -3, y: 0 }, { x: 3, y: 0 })!;
    // Round the wall's end, 50 tiles up, and back down.
    expect(path.at(-1)).toEqual({ x: 3, y: 0 });
    expect(path.length).toBe(106);
    expect(findPath(open, { x: 0, y: -60 }, { x: -120, y: 90 })).toHaveLength(270);
  });

  test("gives up on a tile walled in far away instead of searching the endless desert", () => {
    const walled: Grid = { walkable: (x, y) => !(Math.max(Math.abs(x - 500), Math.abs(y)) === 1) };
    const t0 = performance.now();
    expect(findPath(walled, { x: 0, y: 0 }, { x: 500, y: 0 })).toBeNull();
    expect(performance.now() - t0).toBeLessThan(2000);
  });

  test("keeps within a grid's bounds when it has them", () => {
    const boxed: Grid = { walkable: () => true, bounds: { x0: -2, y0: -2, x1: 2, y1: 2 } };
    expect(findPath(boxed, { x: 0, y: 0 }, { x: 3, y: 0 })).toBeNull();
    expect(findPath(boxed, { x: -2, y: -2 }, { x: 2, y: 2 })).toHaveLength(8);
  });
});
