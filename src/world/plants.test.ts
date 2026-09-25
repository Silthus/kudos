import { expect, test } from "vitest";
import { SPECIES, STAGES, type SpeciesId } from "../../convex/lib/garden";
import { PALETTE, mapHeight, mapWidth, type PixelMap } from "./pixels";
import { keyBedSprite, plantSprite, PLANT_SIZE } from "./plants";

/**
 * Our own pixel plants (#129, #126): 32 × 32 palette-indexed maps, a keyboard-key bed with the plant
 * for its stage and species on top. Species share five canopy shapes in their own colours; dormant
 * plants turn autumn; fruit is gold on the crown, golden leaves hang on it, and an Ancient plant
 * wears a ring.
 */

const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[];
const colours = (m: PixelMap) => new Set(m.rows.join("").replace(/\./g, ""));
const count = (m: PixelMap, ch: string) => [...m.rows.join("")].filter((c) => c === ch).length;
/** The first row with any pixel of the plant above the bed. */
const topRow = (m: PixelMap) => m.rows.findIndex((r) => /[LDTBP]/.test(r));

test("every sprite is 32 × 32 and uses only palette colours (its own or the world's)", () => {
  expect(PLANT_SIZE).toBe(32);
  for (const species of [...SPECIES_IDS, "no_such_tree"])
    for (const s of STAGES)
      for (const dormant of [false, true]) {
        const m = plantSprite({ stage: s.key, species, dormant, fruit: 4, goldenLeaves: 3 });
        expect([mapWidth(m), mapHeight(m)], `${species} ${s.key}`).toEqual([32, 32]);
        expect(new Set(m.rows.map((r) => r.length))).toEqual(new Set([32]));
        for (const ch of colours(m)) expect(m.palette?.[ch] ?? PALETTE[ch], `${species} ${s.key} "${ch}"`).toMatch(/^#[0-9a-f]{6}$/i);
      }
  for (const plant of [false, true]) {
    const bed = keyBedSprite({ sign: plant });
    for (const ch of colours(bed)) expect(bed.palette?.[ch] ?? PALETTE[ch]).toMatch(/^#[0-9a-f]{6}$/i);
  }
});

test("each stage stands taller than the last, on the same key bed", () => {
  const sprites = STAGES.map((s) => plantSprite({ stage: s.key, species: "helpful_oak" }));
  const tops = sprites.map(topRow);
  for (let i = 1; i < tops.length; i++) expect(tops[i], STAGES[i].key).toBeLessThan(tops[i - 1]);
  // The bed's soil is the same under every stage.
  const bed = (m: PixelMap) => m.rows.slice(27).join("\n");
  expect(new Set(sprites.map(bed)).size).toBe(1);
});

test("species share five canopy shapes, each in its own colours; no two look alike once grown", () => {
  const looks = SPECIES_IDS.map((s) => JSON.stringify(plantSprite({ stage: "grown", species: s })));
  expect(new Set(looks).size).toBe(SPECIES_IDS.length);
  const shape = (s: SpeciesId) => plantSprite({ stage: "grown", species: s }).rows.map((r) => r.replace(/[LDTB]/g, "#")).join("\n");
  // Same shape, different colours: oak and maple are both round; pine and cedar both cones.
  expect(shape("helpful_oak")).toBe(shape("kind_maple"));
  expect(shape("patient_pine")).not.toBe(shape("helpful_oak"));
  expect(new Set(SPECIES_IDS.map(shape)).size).toBeGreaterThanOrEqual(5);
});

test("a dormant plant is autumn-coloured and stops blossoming", () => {
  const awake = plantSprite({ stage: "blossoming", species: "generous_cherry" });
  const dormant = plantSprite({ stage: "blossoming", species: "generous_cherry", dormant: true });
  expect(count(awake, "B")).toBeGreaterThan(0);
  expect(count(dormant, "B")).toBe(0);
  expect(dormant.palette!.L.toLowerCase()).toBe("#cf7d17");
  expect(awake.palette!.L.toLowerCase()).not.toBe("#cf7d17");
});

test("fruit is gold on the crown, up to four; golden leaves up to three; only a tree bears fruit", () => {
  const fruit = (n: number, stage: "grown" | "sprout" = "grown") => count(plantSprite({ stage, species: "helpful_oak", fruit: n }), "F");
  expect(fruit(0)).toBe(0);
  expect(fruit(1)).toBe(4); // one fruit is 2 × 2 gold pixels
  expect(fruit(4)).toBe(16);
  expect(fruit(9)).toBe(16);
  expect(fruit(3, "sprout")).toBe(0);
  const leaves = (n: number) => count(plantSprite({ stage: "young", species: "kind_maple", goldenLeaves: n }), "Y");
  expect(leaves(0)).toBe(0);
  expect(leaves(2)).toBe(2 * leaves(1));
  expect(leaves(7)).toBe(3 * leaves(1));
});

test("an Ancient plant wears a ring of lantern light; a Blossoming one doesn't", () => {
  expect(count(plantSprite({ stage: "ancient", species: "helpful_oak" }), "R")).toBeGreaterThan(8);
  expect(count(plantSprite({ stage: "blossoming", species: "helpful_oak" }), "R")).toBe(0);
});

test("an unknown species still draws, as the common oak", () => {
  expect(plantSprite({ stage: "grown", species: "no_such_tree" })).toEqual(plantSprite({ stage: "grown", species: "helpful_oak" }));
});

test("on the map a plant stands without its bed, and can sway one pixel", () => {
  const still = plantSprite({ stage: "grown", species: "helpful_oak", bed: false });
  const swaying = plantSprite({ stage: "grown", species: "helpful_oak", bed: false, sway: true });
  expect(mapWidth(still)).toBe(32);
  expect(still.rows.at(-1)).toMatch(/[^.]/); // it stands on its bottom row
  expect(swaying).not.toEqual(still);
  expect(swaying.rows.at(-1)).toBe(still.rows.at(-1)); // the stem stays put, the crown moves
  const mini = plantSprite({ stage: "grown", species: "helpful_oak", bed: false, mini: true });
  expect(mapHeight(mini)).toBeLessThan(mapHeight(still));
});

test("an empty key bed can carry a small plant sign", () => {
  expect(count(keyBedSprite({ sign: true }), "p")).toBeGreaterThan(count(keyBedSprite({ sign: false }), "p"));
});
