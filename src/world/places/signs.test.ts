import { expect, test } from "vitest";
import { signPoint } from "../paint";
import { PLACES } from "../places";
import { findPath, tileCentre } from "../iso";
import { WORLD, walkGrid } from "../tiles";

/**
 * A place's name sign stays readable with the hedgehog standing at any door (#128 left the store
 * stall's sign on the cabin's doorstep, where the hedgehog covered it). Boxes are in screen pixels
 * at the world's two scales (3× desktop, 2× phone): the sign is 14 px Pixelify text (about 8 px a
 * letter) with 8 px padding a side, 24 px tall, hanging from its point; the hedgehog's body is
 * about 48 × 44 px above its feet on the door tile's centre.
 */
type Box = { x0: number; y0: number; x1: number; y1: number };
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

function signBox(name: string, at: { x: number; y: number }, scale: number): Box {
  const w = name.length * 8 + 16;
  return { x0: at.x * scale - w / 2, x1: at.x * scale + w / 2, y0: at.y * scale - 24, y1: at.y * scale };
}
function hogBox(door: { x: number; y: number }, scale: number): Box {
  const feet = tileCentre(door);
  return { x0: feet.x * scale - 24, x1: feet.x * scale + 24, y0: feet.y * scale - 44, y1: feet.y * scale + 4 };
}

const MINE = ["discoveries", "store", "skills"];

test.each([3, 2])("the gallery's, the stall's and the oak's signs are clear of every door and of every other sign (at %i×)", (scale) => {
  const clashes: string[] = [];
  for (const p of PLACES) {
    const sign = signBox(p.name, signPoint(p), scale);
    for (const q of PLACES) {
      if (!MINE.includes(p.id) && !MINE.includes(q.id)) continue;
      for (const door of q.doors) if (overlaps(sign, hogBox(door, scale))) clashes.push(`${p.name}'s sign over ${q.name}'s door`);
      if (q.id > p.id && overlaps(sign, signBox(q.name, signPoint(q), scale))) clashes.push(`${p.name}'s sign over ${q.name}'s sign`);
    }
  }
  expect(clashes).toEqual([]);
});

test("the way to the gallery, the stall and the oak keeps to the paths, never across a building or the lawn", () => {
  const grid = walkGrid(PLACES);
  for (const id of MINE) {
    const p = PLACES.find((q) => q.id === id)!;
    const walk = findPath(grid, WORLD.spawn, p.doors[0])!;
    const offPath = walk.filter((t) => !["path", "gate", "garden", "plot"].includes(WORLD.terrainAt(t.x, t.y))).map((t) => `${t.x},${t.y}:${WORLD.terrainAt(t.x, t.y)}`);
    expect(offPath, p.name).toEqual([]);
  }
});
