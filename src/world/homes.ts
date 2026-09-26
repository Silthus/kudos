import type { HomeStageId } from "../../convex/lib/homes";
import type { Tile } from "./iso";
import { PixelCanvas, type PixelMap } from "./pixels";
import { fnv1a, mulberry32 } from "../../convex/lib/random";

/**
 * Homes on the tree (#160, plan #152 S5), drawn: a pixel sprite for each of the six build stages,
 * our own art in the dusk palette (#126), each standing on one plot tile of the homes ring
 * (`world.homes`, numbered as the server's `layout().homes`), and the canopy district's night scene
 * composed from the ring. Pure: the world's painter and the windows draw what this returns.
 */

/** Under the sky: a striped bedroll on the sand with a folded blanket for a pillow, and a stub of candle. */
function bedroll() {
  const c = new PixelCanvas(20, 11);
  c.polygon([[2, 6], [11, 2], [18, 6], [9, 10]], "e");
  for (const [x, y] of [[6, 6], [9, 5], [12, 4]]) c.polygon([[x, y], [x + 1, y], [x + 4, y + 2], [x + 3, y + 2]], "E");
  c.polygon([[13, 3], [16, 4.5], [14, 6], [11, 4.5]], "p");
  c.set(4, 4, "c").set(4, 5, "l");
  return c.outline().map();
}

/** Scarves and planks: a plank floor on the branch, two poles and scarves strung between them. */
function planks() {
  const c = new PixelCanvas(22, 19);
  const floor = c.isoBox(1, 1, 2, { left: "B", right: "s", top: "P" }, 19, 3);
  for (const u of [3, 7, 11]) c.wall(floor, "left", u, 0, 1, 2, "b");
  // Poles at the floor's left and right corners.
  c.rect(Math.round(floor.L[0]), 4, 1, floor.L[1] - 4, "b").rect(Math.round(floor.R[0]) - 1, 2, 1, floor.R[1] - 2, "b");
  // Scarves: ember, lantern, violet and pond, hung along a sagging line.
  const colours = ["e", "l", "v", "w", "e", "l", "v", "w"];
  for (let i = 0; i < 14; i++) {
    const x = Math.round(floor.L[0]) + 1 + i;
    const y = 4 - Math.round(i / 7) + (i > 2 && i < 12 ? 1 : 0);
    c.set(x, y, "p");
    if (i % 2 === 0) c.rect(x, y + 1, 2, 3, colours[(i / 2) % colours.length]);
  }
  return c.outline().map();
}

/** A leaf hut: a dome of leaves on a soil floor, a round doorway with a warm glow inside. */
function leafHut() {
  const c = new PixelCanvas(22, 22);
  c.isoBox(1, 1, 1, { left: "s", right: "b", top: "s" }, 22, 3);
  c.disc(11, 12, 8, "G");
  c.disc(10, 11, 7, "g");
  for (const [x, y] of [[6, 8], [9, 6], [13, 7], [15, 11], [7, 12], [11, 9]]) c.rect(x, y, 2, 1, "u");
  c.rect(9, 13, 4, 6, "b").rect(10, 12, 2, 1, "b").rect(10, 15, 2, 3, "l");
  return c.outline().map();
}

/** A timber house: log walls, a tiled roof, a door and a lit window. */
function timberHouse() {
  const c = new PixelCanvas(22, 28);
  const walls = c.isoBox(1, 1, 10, { left: "B", right: "b", top: "B" }, 28, 3);
  for (const v of [3, 6]) c.wall(walls, "left", 0, v, 8, 1, "s").wall(walls, "right", 0, v, 8, 1, "k");
  c.wall(walls, "right", 3, 0, 3, 6, "k").wall(walls, "left", 3, 3, 3, 3, "l");
  const roof = c.isoBox(1.2, 1.2, 1, { left: "E", right: "E", top: "E" }, 19, 1.4);
  c.hipRoof(roof, 7, { front: "e", side: "E", back: "E" });
  c.rect(15, 3, 2, 5, "M").set(15, 2, "m");
  return c.outline().map();
}

/** A lantern lodge: a broad lodge under a leaf roof, lanterns hanging from its eaves, every window lit. */
function lanternLodge() {
  const c = new PixelCanvas(30, 33);
  const walls = c.isoBox(1.5, 1.5, 12, { left: "B", right: "b", top: "B" }, 33, 3);
  for (const v of [4, 8]) c.wall(walls, "left", 0, v, 12, 1, "s").wall(walls, "right", 0, v, 12, 1, "k");
  c.wall(walls, "left", 2, 5, 3, 4, "l").wall(walls, "left", 8, 5, 3, 4, "l").wall(walls, "right", 7, 5, 3, 4, "l").wall(walls, "right", 2, 0, 3, 7, "k");
  const roof = c.isoBox(1.9, 1.9, 1, { left: "G", right: "G", top: "G" }, 23, 0);
  c.hipRoof(roof, 9, { front: "g", side: "G", back: "G" });
  for (const [x, y] of [[9, 9], [14, 6], [19, 10], [12, 12]]) c.rect(x, y, 2, 1, "u");
  // Lanterns on short cords from the eaves.
  for (const x of [1, 28]) c.set(x, 20, "b").rect(x, 21, 1, 2, "l");
  c.set(15, 30, "b").rect(15, 31, 1, 1, "l");
  return c.outline().map();
}

/** A canopy manor: two storeys under a crown of leaves, a balcony, lanterns all round. */
function canopyManor() {
  const c = new PixelCanvas(32, 44);
  c.disc(16, 10, 11, "G").disc(15, 9, 9, "g");
  for (const [x, y] of [[9, 5], [16, 3], [21, 8], [8, 11], [13, 6], [19, 13]]) c.rect(x, y, 2, 1, "u");
  const ground = c.isoBox(1.6, 1.6, 11, { left: "B", right: "b", top: "B" }, 44, 3.2);
  c.wall(ground, "left", 2, 3, 3, 4, "l").wall(ground, "left", 9, 3, 3, 4, "l").wall(ground, "right", 2, 0, 3, 7, "k").wall(ground, "right", 8, 3, 3, 4, "l");
  const upper = c.isoBox(1.3, 1.3, 8, { left: "p", right: "P", top: "P" }, 33, 5.6);
  c.wall(upper, "left", 2, 2, 2, 3, "l").wall(upper, "left", 7, 2, 2, 3, "l").wall(upper, "right", 3, 2, 2, 3, "l");
  // The balcony rail between the storeys.
  c.wall(ground, "left", 0, 11, 13, 1, "s").wall(ground, "right", 0, 11, 13, 1, "s");
  const roof = c.isoBox(1.6, 1.6, 1, { left: "E", right: "E", top: "E" }, 25, 3.2);
  c.hipRoof(roof, 8, { front: "e", side: "E", back: "E" });
  for (const [x, y] of [[2, 25], [29, 25], [3, 35], [28, 35]]) c.set(x, y, "b").rect(x, y + 1, 1, 2, "l");
  return c.outline().map();
}

export const HOME_SPRITES: Record<HomeStageId, PixelMap> = {
  sky: bedroll(),
  planks: planks(),
  leaf_hut: leafHut(),
  timber_house: timberHouse(),
  lantern_lodge: lanternLodge(),
  canopy_manor: canopyManor(),
};

const building = new Map<HomeStageId, PixelMap>();
/** A home's sprite; `buildingNext`: it's building its next stage, so scaffolding stands beside it. */
export function homeSprite(stage: HomeStageId, buildingNext = false): PixelMap {
  const home = HOME_SPRITES[stage];
  if (!buildingNext) return home;
  let m = building.get(stage);
  if (!m) {
    const w = home.rows[0].length;
    const h = Math.max(home.rows.length, 16);
    const c = new PixelCanvas(w + 4, h);
    c.stamp(home, 0, h - home.rows.length);
    // Two poles and three rungs on the right, a plank across the top.
    c.rect(w, h - 14, 1, 13, "b").rect(w + 3, h - 14, 1, 13, "b");
    for (const y of [h - 12, h - 8, h - 4]) c.rect(w, y, 4, 1, "B");
    c.rect(w - 1, h - 15, 6, 1, "P").rect(w - 1, h - 16, 2, 1, "l");
    m = c.map();
    building.set(stage, m);
  }
  return m;
}

/** A home as `api.homes.all` lists it. */
export type HomeOnRing = { plot: number; memberId: string; name: string; stage: HomeStageId; building: boolean };
/** A home standing on the ring: its tile and sprite. */
export type RingHome = HomeOnRing & { tile: Tile; sprite: PixelMap };

/** The homes the world draws: each on its plot's tile; none where a district covers the plot or the plot isn't on this tree. */
export function ringHomes(plots: (Tile | null)[], homes: HomeOnRing[]): RingHome[] {
  return homes.flatMap((h) => {
    const tile = plots[h.plot];
    return tile ? [{ ...h, tile, sprite: homeSprite(h.stage, h.building) }] : [];
  });
}

/**
 * Where you stand to visit a home: the tile in front of it (the hedgehog is drawn before its door),
 * else beside or behind it, whichever you can walk to; the plot itself when none can be (it's sand).
 */
export function homeDoor(home: { tile: Tile }, walkable: (x: number, y: number) => boolean): Tile {
  const { x, y } = home.tile;
  return [{ x: x + 1, y: y + 1 }, { x: x + 1, y }, { x, y: y + 1 }, { x: x - 1, y }, { x, y: y - 1 }].find((t) => walkable(t.x, t.y)) ?? home.tile;
}

/** Whether an art point (map pixels) falls on a home's sprite, standing on its plot's tile (as `paint.ts` stands it). */
export function onHomeSprite(home: RingHome, art: { x: number; y: number }, tileCentre: (t: Tile) => { x: number; y: number }): boolean {
  const c = tileCentre(home.tile);
  const w = home.sprite.rows[0].length;
  const foot = c.y + 3;
  return art.x >= c.x - w / 2 && art.x <= c.x + w / 2 && art.y >= foot - home.sprite.rows.length && art.y <= foot;
}

/** The plots a home may still go on, in plot order: drawn (no district on them) and nobody's. */
export function freePlots(plots: (Tile | null)[], taken: { plot: number }[]): number[] {
  const used = new Set(taken.map((t) => t.plot));
  return plots.flatMap((t, i) => (t && !used.has(i) ? [i] : []));
}

/** "The next free plot": the lowest-numbered free one; null when the ring is full. */
export function nextFreePlot(plots: (Tile | null)[], taken: { plot: number }[]): number | null {
  return freePlots(plots, taken)[0] ?? null;
}

/**
 * Where a plot shows in a picture of the ring from above (the canopy scene, the plot picker): pixels
 * from the trunk, turned so the world's front corner (+x, +y) points down the page.
 */
export function ringPoint(t: Tile): { x: number; y: number } {
  return { x: (t.x - t.y) * 1.06, y: (t.x + t.y) * 1.06 };
}

/** Pixels a home's window grows by with its stage in the canopy scene (the bedroll is a campfire). */
const LIGHT_SIZE: Record<HomeStageId, number> = { sky: 1, planks: 1, leaf_hut: 2, timber_house: 2, lantern_lodge: 3, canopy_manor: 3 };

/**
 * The canopy district's scene (#160): the tree seen from above at night, its lumpy crown in the
 * middle and a branch out to every home on the ring, each home a lit window (bigger for a bigger
 * home) in a pool of ember light, empty plots faint in the dark, stars from the seed round the edge.
 * The world's front corner (+x, +y) is down the page.
 */
export function canopyScene(plots: (Tile | null)[], homes: { plot: number; stage: HomeStageId }[], seed: number): PixelMap {
  const W = 128;
  const H = 104;
  const cx = W / 2;
  const cy = H / 2;
  const c = new PixelCanvas(W, H);
  const rand = mulberry32(fnv1a(`canopy:${seed >>> 0}`));
  // The night: dusk, deepening in a dither towards the corners.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) c.set(x, y, Math.hypot(x - cx, y - cy) > 50 && (x + y) % 2 === 0 ? "k" : "d");
  for (let i = 0; i < 60; i++) {
    const [x, y] = [Math.floor(rand() * W), Math.floor(rand() * H)];
    if (Math.hypot(x - cx, y - cy) > 30) c.set(x, y, rand() < 0.3 ? "p" : "M");
  }
  const at = (t: Tile) => {
    const p = ringPoint(t);
    return { x: Math.round(cx + p.x), y: Math.round(cy + p.y) };
  };
  const built = new Map(homes.map((h) => [h.plot, h.stage]));
  // A branch from the crown out to each home, drawn first so the crown and the homes lie over it.
  plots.forEach((t, i) => {
    if (!t || !built.has(i)) return;
    const p = at(t);
    const steps = Math.ceil(Math.hypot(p.x - cx, p.y - cy));
    for (let k = 0; k <= steps; k++) {
      const [x, y] = [Math.round(cx + ((p.x - cx) * k) / steps), Math.round(cy + ((p.y - cy) * k) / steps)];
      c.set(x, y, "b");
      if (k > steps * 0.7) c.set(x + 1, y, "b");
    }
  });
  // The crown: dark leaves, clumps of lighter and deeper leaves, the sap glowing through, lanterns in its branches.
  c.disc(cx, cy, 25, "G").disc(cx - 1, cy - 1, 22, "g");
  for (let i = 0; i < 16; i++) {
    const [a, r] = [rand() * Math.PI * 2, 6 + rand() * 14];
    c.disc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.5 + rand() * 2, i % 3 === 0 ? "G" : "u");
  }
  for (let i = 0; i < 10; i++) {
    const [a, r] = [rand() * Math.PI * 2, rand() * 20];
    c.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), "y");
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rand() * 0.4;
    c.set(Math.round(cx + Math.cos(a) * 16), Math.round(cy + Math.sin(a) * 16), "l");
  }
  plots.forEach((t, i) => {
    if (!t) return;
    const p = at(t);
    const stage = built.get(i);
    if (!stage) {
      c.set(p.x, p.y, "D").set(p.x + 1, p.y, "n");
      return;
    }
    const s = LIGHT_SIZE[stage];
    // A pool of ember light, dithered, then the roof and its lit window.
    for (let y = -s - 2; y <= s + 2; y++)
      for (let x = -s - 2; x <= s + 2; x++) if ((x + y) % 2 === 0 && x * x + y * y <= (s + 2) ** 2 && c.get(p.x + x, p.y + y) !== "l") c.set(p.x + x, p.y + y, "E");
    c.rect(p.x - s, p.y - s, s * 2, s * 2, "b");
    c.rect(p.x - Math.floor(s / 2), p.y - Math.floor(s / 2), Math.max(1, s), Math.max(1, s), "l");
  });
  return c.map();
}
