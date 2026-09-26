import { expect, test } from "vitest";
import { gardenPlots, plotFrom, plotIndex, ringBeds } from "./gardenWorld";
import { BEDS, PLOTS } from "./places/garden";
import { keyBedSprite, plantSprite } from "./plants";

/**
 * Your garden on the map (#129, on the tree's terrace since #156): your plots are key beds on the
 * raised lawn, round the little square in the middle first; the teammates you exchange the most kudos
 * with have their beds nearest yours.
 */

const plant = (extra: object = {}) => ({ plot: 0, species: "helpful_oak", stage: "grown", dormant: false, fruit: [], goldenLeaves: 0, lastWatered: "2026-09-20", ...extra });
const garden = (extra: object = {}) => ({ open: true as const, plots: 3, balance: 28, cost: 10, candidates: [{ memberId: "m2" }], plants: [plant(), plant({ plot: 1, species: "patient_pine", stage: "sprout" })], ...extra });
/** The sprite on your k-th plot. */
const on = (plots: ReturnType<typeof gardenPlots>, k: number) => plots[k];

test("your plots go round the middle square first, one on each side, then further out", () => {
  expect(new Set(PLOTS.map((t) => `${t.x},${t.y}`)).size).toBe(PLOTS.length);
  expect(PLOTS.length).toBeGreaterThanOrEqual(6); // MAX_PLOTS
  expect(PLOTS.slice(0, 4)).toEqual([
    { x: 1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
  ]);
  const far = (t: { x: number; y: number }) => Math.max(Math.abs(t.x), Math.abs(t.y));
  for (let k = 1; k < PLOTS.length; k++) expect(far(PLOTS[k])).toBeGreaterThanOrEqual(far(PLOTS[k - 1]));
});

test("each of your plots is a key bed on the map: your plants first, then empty keys; the rest of the lawn stays lawn", () => {
  const plots = gardenPlots(garden() as never, { today: "2026-09-25" });
  expect(plots).toHaveLength(PLOTS.length);
  expect(on(plots, 0)).toEqual(plantSprite({ stage: "grown", species: "helpful_oak", dormant: false, fruit: 0, goldenLeaves: 0 }));
  expect(on(plots, 1)).toEqual(plantSprite({ stage: "sprout", species: "patient_pine", dormant: false, fruit: 0, goldenLeaves: 0 }));
  expect(on(plots, 2)).toEqual(keyBedSprite({ sign: true })); // someone to plant for: a small sign
  expect(plots.filter((p) => p === null)).toHaveLength(PLOTS.length - 3);
  // Nobody to plant for, too few coins, or every plot in use (after a reset): a bare key (review #3).
  for (const g of [garden({ candidates: [] }), garden({ balance: 9 })]) expect(on(gardenPlots(g as never, { today: "2026-09-25" }), 2)).toEqual(keyBedSprite({ sign: false }));
  const full = garden({ plots: 2, plants: [plant(), plant({ plot: 2 })] });
  expect(on(gardenPlots(full as never, { today: "2026-09-25" }), 1)).toEqual(keyBedSprite({ sign: false }));
});

test("fruit and golden leaves show on the map; a plant sways on its watering day, all of them when you pick", () => {
  const g = garden({ plants: [plant({ fruit: [{ day: "d", coins: 1 }, { day: "e", coins: 2 }], goldenLeaves: 1 }), plant({ plot: 1, lastWatered: "2026-09-25" })] });
  const still = gardenPlots(g as never, { today: "2026-09-25" });
  expect(on(still, 0)).toEqual(plantSprite({ stage: "grown", species: "helpful_oak", dormant: false, fruit: 2, goldenLeaves: 1 }));
  const watered = gardenPlots(g as never, { today: "2026-09-25", sway: "watered" });
  expect(on(watered, 0)).toEqual(on(still, 0));
  expect(on(watered, 1)).toEqual(plantSprite({ stage: "grown", species: "helpful_oak", dormant: false, fruit: 0, goldenLeaves: 0, sway: true }));
  const picked = gardenPlots(g as never, { today: "2026-09-25", sway: "picked" });
  expect(on(picked, 0)).not.toEqual(on(still, 0));
});

test("a plant keeps its key bed: with the first uprooted, the first bed is an empty key again", () => {
  const plots = gardenPlots(garden({ plants: [plant({ plot: 1 })] }) as never, { today: "2026-09-25" });
  expect(on(plots, 0)).toEqual(keyBedSprite({ sign: true }));
  expect(on(plots, 1)).toEqual(plantSprite({ stage: "grown", species: "helpful_oak", dormant: false, fruit: 0, goldenLeaves: 0 }));
});

test("a locked, hidden or loading garden is all lawn", () => {
  for (const g of [undefined, null, { open: false, opensAt: 3 }]) expect(gardenPlots(g as never, { today: "2026-09-25" }).every((p) => p === null)).toBe(true);
});

test("more plants than plots (after a skill reset) still all show", () => {
  expect(gardenPlots(garden({ plots: 1 }) as never, { today: "2026-09-25" }).filter(Boolean)).toHaveLength(2);
});

test("plots are found by their tile, in planting order, and by the URL only if they're yours", () => {
  expect(plotIndex(PLOTS, PLOTS[0])).toBe(0);
  expect(plotIndex(PLOTS, PLOTS[5])).toBe(5);
  expect(plotIndex(PLOTS, { x: 0, y: 0 })).toBe(-1);
  expect(plotFrom("?plot=2", 3)).toBe(2);
  expect(plotFrom("?plot=3", 3)).toBeNull();
  expect(plotFrom("?plot=-1", 3)).toBeNull();
  expect(plotFrom("?plot=1.5", 3)).toBeNull();
  expect(plotFrom("", 3)).toBeNull();
});

test("the ring: the closest teammates on the beds nearest your garden, each with their tallest plant", () => {
  const ring = [
    { memberId: "m5", name: "Cleo", plants: 1, top: { species: "helpful_oak", stage: "sapling" } },
    { memberId: "m3", name: "Ben", plants: 2, top: { species: "kind_maple", stage: "grown" } },
  ];
  const beds = ringBeds(ring as never, BEDS);
  expect(beds.map((b) => [b.name, b.tile])).toEqual([
    ["Cleo", BEDS[0]],
    ["Ben", BEDS[1]],
  ]);
  expect(beds[1]).toMatchObject({ memberId: "m3", plants: 2, sprite: plantSprite({ stage: "grown", species: "kind_maple", bed: false, mini: true }) });
  expect(ringBeds(Array.from({ length: 40 }, (_, i) => ({ ...ring[0], memberId: `m${i}` })) as never, BEDS)).toHaveLength(BEDS.length);
  // Before the terrace opens there are no beds, so nobody's in the ring.
  expect(ringBeds(ring as never, [])).toEqual([]);
});
