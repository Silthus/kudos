import { describe, expect, test } from "vitest";
import { findPath, reachable } from "./iso";
import { PLACES } from "./places";
import type { PlaceDef } from "./places";
import { GROUND, MAP_H, MAP_W, RING, WORLD, buildWorld, groundFrame, walkGrid } from "./tiles";

const key = (t: { x: number; y: number }) => `${t.x},${t.y}`;

describe("the world map", () => {
  test("is 40 × 28 tiles", () => {
    expect([WORLD.width, WORLD.height]).toEqual([MAP_W, MAP_H]);
    expect([MAP_W, MAP_H]).toEqual([40, 28]);
  });

  test("you start in the heart of your garden", () => {
    const garden = PLACES.find((p) => p.id === "garden")!;
    expect(garden.doors.map(key)).toContain(key(WORLD.spawn));
  });

  test("every place's door is reachable on foot from the garden, with every building standing", () => {
    const from = reachable(walkGrid(PLACES), WORLD.spawn);
    for (const p of PLACES) for (const door of p.doors) expect(from.has(key(door)), `${p.name} at ${key(door)}`).toBe(true);
  });

  test("so is every neighbour's bed", () => {
    const from = reachable(WORLD, WORLD.spawn);
    expect(WORLD.beds.length).toBeGreaterThanOrEqual(12);
    for (const bed of WORLD.beds) expect(from.has(key(bed)), key(bed)).toBe(true);
  });

  test("buildings on your map, water and the hedge round the edge are in the way; the pond is water", () => {
    const pond = PLACES.find((p) => p.id === "compare")!;
    expect(WORLD.terrainAt(pond.footprint.x, pond.footprint.y)).toBe("water");
    for (const p of PLACES.filter((p) => !p.walkable)) expect(walkGrid(PLACES).walkable(p.footprint.x, p.footprint.y), p.id).toBe(false);
    expect(WORLD.walkable(0, 0)).toBe(false);
    expect(WORLD.walkable(-1, 5)).toBe(false);
    // Nobody walks off the edge of the world: every tile a walk reaches is inside the hedge.
    for (const id of reachable(WORLD, WORLD.spawn)) {
      const [x, y] = id.split(",").map(Number);
      expect(x > 0 && y > 0 && x < MAP_W - 1 && y < MAP_H - 1, id).toBe(true);
    }
  });

  test("a building that isn't on your map is no invisible wall: its plot is lawn you can walk", () => {
    const gatehouse = PLACES.find((p) => p.id === "admin")!;
    const withoutIt = walkGrid(PLACES.filter((p) => p.id !== "admin"));
    expect(withoutIt.walkable(gatehouse.footprint.x, gatehouse.footprint.y)).toBe(true);
    expect(walkGrid(PLACES).walkable(gatehouse.footprint.x, gatehouse.footprint.y)).toBe(false);
  });

  test("a door off a corner of the ring road still gets its path, round the corner", () => {
    const corner: PlaceDef = { id: "corner", name: "Corner", footprint: { x: 6, y: 1, w: 2, h: 2 }, doors: [{ x: 8, y: 3 }], sprite: { rows: ["k"] } };
    const world = buildWorld([...PLACES.filter((p) => p.id !== "discoveries"), corner]);
    expect(world.terrainAt(8, 3)).toBe("path");
    expect(reachable(walkGrid([corner], world), world.spawn).has("8,3")).toBe(true);
  });

  test("a path leads from each door, so the way there is a walk along paths", () => {
    for (const p of PLACES.filter((p) => p.id !== "garden")) {
      const walk = findPath(walkGrid(PLACES), WORLD.spawn, p.doors[0])!;
      const onPath = walk.filter((t) => ["path", "gate"].includes(WORLD.terrainAt(t.x, t.y))).length;
      expect(onPath / walk.length, p.id).toBeGreaterThan(0.6);
    }
  });
});

describe("the place files keep to the contract", () => {
  test("doors are outside the ring road, on the building's front (+x or +y) side", () => {
    // Flat places (the pond, the garden) have no front to hide behind.
    for (const p of PLACES.filter((p) => !p.walkable && p.terrain !== "water")) {
      const { x, y, w, h } = p.footprint;
      for (const d of p.doors) {
        const outsideRing = d.x < RING.x0 || d.x > RING.x1 || d.y < RING.y0 || d.y > RING.y1;
        expect(outsideRing, `${p.id} door ${d.x},${d.y}`).toBe(true);
        const front = (d.x === x + w && d.y >= y && d.y < y + h) || (d.y === y + h && d.x >= x && d.x < x + w);
        expect(front, `${p.id} door ${d.x},${d.y}`).toBe(true);
      }
    }
  });
});

describe("ground tiles", () => {
  test("are 16 × 16 pixel maps in the palette", () => {
    for (const [name, frames] of Object.entries(GROUND)) {
      for (const map of frames) {
        expect(map.rows, name).toHaveLength(16);
        for (const row of map.rows) expect(row, name).toMatch(/^[kdgGusbpPlewWicmMv]{16}$/);
      }
    }
  });

  test("water shimmers in two frames, slowly; everything else holds still", () => {
    expect(GROUND.water).toHaveLength(2);
    expect(GROUND.water[0].rows).not.toEqual(GROUND.water[1].rows);
    expect(groundFrame(0)).toBe(0);
    expect(groundFrame(900)).toBe(0);
    expect(groundFrame(1300)).toBe(1);
    expect(groundFrame(2600)).toBe(0);
    for (const t of ["lawn", "path", "garden", "hedge"] as const) expect(GROUND[t], t).toHaveLength(1);
  });
});
