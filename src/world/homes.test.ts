import { describe, expect, test } from "vitest";
import { DEMO_HOMES } from "../../convex/lib/demoHomes";
import { HOME_STAGES } from "../../convex/lib/homes";
import { layout } from "../../convex/lib/tree";
import { canopyScene, freePlots, HOME_SPRITES, homeDoor, homeSprite, nextFreePlot, onHomeSprite, ringHomes } from "./homes";
import { mapHeight, mapWidth, pixelAt } from "./pixels";
import { paintStanding, standingRect } from "./paint";
import { tileCentre } from "./iso";
import { PLACES } from "./places";
import { buildWorld } from "./world";

/** Homes on the tree (#160): a pixel sprite per stage, drawn on the ring at the world's plots. */

const DEMO_SEED = 0x4c756d65;
const demoWorld = () => buildWorld({ seed: DEMO_SEED, layout: layout(DEMO_SEED, 3500), planted: true, standing: PLACES.map((p) => p.id) });

describe("a sprite per stage", () => {
  test("six different homes, each standing on one tile and growing with its stage", () => {
    const sprites = HOME_STAGES.map((s) => HOME_SPRITES[s.id]);
    expect(new Set(sprites.map((m) => m.rows.join("\n"))).size).toBe(6);
    for (const m of sprites) {
      expect(mapWidth(m)).toBeLessThanOrEqual(32);
      expect(m.rows.every((r) => r.length === mapWidth(m))).toBe(true);
    }
    const heights = sprites.map(mapHeight);
    expect(heights).toEqual([...heights].sort((a, b) => a - b));
    expect(heights[5]).toBeGreaterThan(heights[0] * 2);
  });

  test("the lantern lodge and the canopy manor hang lanterns; a home building its next stage wears scaffolding", () => {
    const lit = (m: ReturnType<typeof homeSprite>) => m.rows.some((r, y) => [...r].some((_, x) => pixelAt(m, x, y) === "#f7a501"));
    expect(lit(HOME_SPRITES.lantern_lodge)).toBe(true);
    expect(lit(HOME_SPRITES.canopy_manor)).toBe(true);
    const building = homeSprite("leaf_hut", true);
    expect(building.rows.join()).not.toBe(HOME_SPRITES.leaf_hut.rows.join());
    expect(mapWidth(building)).toBeGreaterThanOrEqual(mapWidth(HOME_SPRITES.leaf_hut));
  });
});

describe("the ring", () => {
  test("each home stands on its plot's tile; a plot a district covers has none", () => {
    const plots = [{ x: 26, y: 2 }, null, { x: -21, y: 16 }];
    const homes = ringHomes(plots, [
      { plot: 0, memberId: "m1", name: "Ana", stage: "timber_house", building: false },
      { plot: 1, memberId: "m2", name: "Ben", stage: "sky", building: false },
      { plot: 2, memberId: "m3", name: "Cleo", stage: "planks", building: true },
      { plot: 9, memberId: "m4", name: "Dev", stage: "sky", building: false },
    ]);
    expect(homes.map((h) => [h.name, h.tile])).toEqual([
      ["Ana", { x: 26, y: 2 }],
      ["Cleo", { x: -21, y: 16 }],
    ]);
    expect(homes[0].sprite).toBe(HOME_SPRITES.timber_house);
    expect(homes[1].sprite.rows.join()).toBe(homeSprite("planks", true).rows.join());
  });

  test("you visit a home from the tile in front of it, or the nearest you can walk to", () => {
    const home = { tile: { x: 10, y: 10 } };
    expect(homeDoor(home, () => true)).toEqual({ x: 11, y: 11 });
    expect(homeDoor(home, (x, y) => !(x === 11 && y === 11))).toEqual({ x: 11, y: 10 });
    expect(homeDoor(home, () => false)).toEqual({ x: 10, y: 10 });
  });

  test("a tap on a home's sprite finds it, a tap beside it doesn't", () => {
    const [home] = ringHomes([{ x: 10, y: 10 }], [{ plot: 0, memberId: "m1", name: "Ana", stage: "timber_house", building: false }]);
    const c = tileCentre(home.tile);
    expect(onHomeSprite(home, { x: c.x, y: c.y - 5 }, tileCentre)).toBe(true);
    expect(onHomeSprite(home, { x: c.x + 40, y: c.y - 5 }, tileCentre)).toBe(false);
  });

  test("free plots skip the taken and the covered; the next free plot is the lowest", () => {
    const plots = [{ x: 1, y: 1 }, null, { x: 2, y: 2 }, { x: 3, y: 3 }];
    expect(freePlots(plots, [{ plot: 0 }])).toEqual([2, 3]);
    expect(nextFreePlot(plots, [{ plot: 0 }])).toBe(2);
    expect(nextFreePlot(plots, [{ plot: 0 }, { plot: 2 }, { plot: 3 }])).toBeNull();
  });

  test("the world paints each home's sprite standing on its plot", () => {
    const world = demoWorld();
    const [home] = ringHomes(world.homes, [{ plot: 12, memberId: "m1", name: "Lena", stage: "canopy_manor", building: false }]);
    const furniture = { beds: [], plots: [], homes: [home] };
    const rect = standingRect(world, furniture);
    const img = { width: rect.width, height: rect.height, data: new Uint8ClampedArray(rect.width * rect.height * 4) };
    paintStanding(img, rect, world, furniture, "all");
    const bare = { width: rect.width, height: rect.height, data: new Uint8ClampedArray(rect.width * rect.height * 4) };
    paintStanding(bare, rect, world, { beds: [], plots: [] }, "all");
    // Just above the plot's front corner: the manor's walls, and only with the home in the furniture.
    const c = tileCentre(home.tile);
    const at = (p: typeof img, x: number, y: number) => p.data[((Math.round(y) - rect.y) * rect.width + (Math.round(x) - rect.x)) * 4 + 3];
    expect(at(img, c.x, c.y)).toBe(255);
    expect(at(bare, c.x, c.y)).toBe(0);
  });

  test("a plot with a home glows in a pool of warm light; an empty one stays dark", () => {
    const world = buildWorld({ seed: DEMO_SEED, layout: layout(DEMO_SEED, 3500), planted: true, standing: [], litPlots: [12] });
    const at = (t: { x: number; y: number } | null) => world.lights.some((l) => l.x === t!.x && l.y === t!.y);
    expect(at(world.homes[12])).toBe(true);
    expect(at(world.homes[17])).toBe(false);
  });

  test("every home the demo seeds stands on a plot its world draws", () => {
    const world = demoWorld();
    for (const h of DEMO_HOMES) expect(world.homes[h.plot], `plot ${h.plot}`).not.toBeNull();
  });
});

describe("the canopy at night", () => {
  test("a scene seen from above: every home lit, empty plots faint, the same for the same ring", () => {
    const world = demoWorld();
    const homes = DEMO_HOMES.map((h) => ({ plot: h.plot, stage: h.stage }));
    const scene = canopyScene(world.homes, homes, DEMO_SEED);
    expect(canopyScene(world.homes, homes, DEMO_SEED)).toEqual(scene);
    const count = (hex: string) => scene.rows.reduce((n, r, y) => n + [...r].filter((_, x) => pixelAt(scene, x, y) === hex).length, 0);
    const litWith = count("#f7a501");
    const empty = canopyScene(world.homes, [], DEMO_SEED);
    const litWithout = empty.rows.reduce((n, r, y) => n + [...r].filter((_, x) => pixelAt(empty, x, y) === "#f7a501").length, 0);
    // Each home is a lit window at least.
    expect(litWith - litWithout).toBeGreaterThanOrEqual(homes.length);
  });
});
