import { expect, test } from "vitest";
import { TREE_STAGES, layout } from "../../../convex/lib/tree";
import { hogsOf, labelsOf, signPoints } from "../paint";
import { PLACES } from "../places";
import { tileCentre } from "../iso";
import { buildWorld } from "../world";

/**
 * A place's name sign stays readable with the hedgehog standing at any door (#128 left the store
 * stall's sign on the cabin's doorstep, where the hedgehog covered it), wherever the tree's layout
 * puts the places (#156). Boxes are in screen pixels at the world's two scales (3× desktop, 2×
 * phone): the sign is 14 px Pixelify text (about 8 px a letter) with 8 px padding a side, 24 px
 * tall, hanging from its point; the hedgehog's body is about 48 × 44 px above its feet on the door
 * tile's centre.
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

const SEEDS = Array.from({ length: 40 }, (_, i) => (i * 2_654_435_761 + 17) >>> 0);

test.each([3, 2])("no sign or label covers a door or another sign, on any tree, at any stage (at %i×)", (scale) => {
  const clashes = new Set<string>();
  for (const seed of SEEDS)
    for (const stage of TREE_STAGES) {
      const w = buildWorld({ seed, layout: layout(seed, stage.growth), planted: true, standing: PLACES.map((p) => p.id) });
      // Every name over the world: the places' signs, the elder hog's, the districts' markers and the dim signs of what opens next.
      const labels = labelsOf(w);
      const signs = signPoints(w.places, labels, hogsOf(w));
      // Every place has its sign; a label may be left out where it can't hang clear.
      for (const p of w.places) expect(signs.has(p.id), p.id).toBe(true);
      const all = [...w.places.map((p) => ({ id: p.id, name: p.name })), ...labels.filter((l) => signs.has(l.id))];
      for (const p of all) {
        const sign = signBox(p.name, signs.get(p.id)!, scale);
        for (const q of w.places) for (const door of q.doors) if (overlaps(sign, hogBox(door, scale))) clashes.add(`${seed}: ${p.name}'s sign over ${q.name}'s door`);
        for (const hog of hogsOf(w)) if (overlaps(sign, hogBox(hog, scale))) clashes.add(`${seed}: ${p.name}'s sign over the hedgehog at ${hog.x},${hog.y}`);
        for (const q of all) if (q.id > p.id && overlaps(sign, signBox(q.name, signs.get(q.id)!, scale))) clashes.add(`${seed}: ${p.name}'s sign over ${q.name}'s sign`);
      }
    }
  expect([...clashes]).toEqual([]);
});
