import type { Grid, Tile } from "./iso";
import { PLACES, type PlaceDef } from "./places";
import { PixelCanvas, type PixelMap } from "./pixels";

/**
 * The ground of the world (#126 "Map"): a 40 × 28 garden at dusk inside a hedge. Your garden is the
 * raised lawn in the middle, with key beds round a little square; a ring of neighbours' beds
 * round it; the ring road; and the places outside it, each joined to the ring by its own path.
 *
 * The layout is built from a few rules rather than typed out, so a place that moves (its file in
 * `places/`) takes its path along. `tiles.test.ts` guards that every door stays reachable.
 */

export const MAP_W = 40;
export const MAP_H = 28;

export type Terrain = "void" | "hedge" | "lawn" | "path" | "water" | "garden" | "fence" | "gate" | "plot" | "bed";

/** Terrain you can stand on. Buildings, trees and lantern posts block on top of it. */
const WALKABLE: Record<Terrain, boolean> = {
  void: false,
  hedge: false,
  lawn: true,
  path: true,
  water: false,
  garden: true,
  fence: false,
  gate: true,
  plot: true,
  bed: true,
};

/** The ring road round the neighbours' beds, and your raised garden inside it. */
export const RING = { x0: 11, y0: 5, x1: 28, y1: 22 };
export const GARDEN = { x0: 15, y0: 9, x1: 24, y1: 18 };

export type DecorKind = "tree" | "pine" | "bush" | "lantern" | "flowers";
export type Decor = { kind: DecorKind; tile: Tile };

export type World = Grid & {
  terrainAt: (x: number, y: number) => Terrain;
  /** Where the hedgehog starts: the heart of your garden. */
  spawn: Tile;
  /** One bed per neighbour, nearest your garden's front first. */
  beds: Tile[];
  /** Your key beds, in planting order. */
  plots: Tile[];
  decor: Decor[];
};

/** A stable pseudo-random number in [0, 1) for a tile, so the world looks the same every visit. */
export function hash(x: number, y: number, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** How far a tile is from the middle of the world: a squarish oval, under 1 inside the hedge. */
function edgeDistance(x: number, y: number) {
  const dx = (x + 0.5 - MAP_W / 2) / (MAP_W / 2);
  const dy = (y + 0.5 - MAP_H / 2) / (MAP_H / 2);
  return Math.sqrt(Math.sqrt(dx ** 4 + dy ** 4));
}

const inRect = (x: number, y: number, r: { x0: number; y0: number; x1: number; y1: number }) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

export function buildWorld(places: PlaceDef[]): World {
  const terrain: Terrain[] = Array(MAP_W * MAP_H).fill("void");
  const blocked = new Set<number>();
  const at = (x: number, y: number) => y * MAP_W + x;
  const set = (x: number, y: number, t: Terrain) => {
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) terrain[at(x, y)] = t;
  };
  const get = (x: number, y: number): Terrain => (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H ? terrain[at(x, y)] : "void");

  // The world's edge: lawn inside a ragged hedge, dusk beyond.
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const d = edgeDistance(x, y) + (hash(x, y, 1) - 0.5) * 0.06;
      set(x, y, d < 0.93 ? "lawn" : d < 1.02 ? "hedge" : "void");
    }

  // The ring road.
  for (let x = RING.x0; x <= RING.x1; x++) (set(x, RING.y0, "path"), set(x, RING.y1, "path"));
  for (let y = RING.y0; y <= RING.y1; y++) (set(RING.x0, y, "path"), set(RING.x1, y, "path"));

  // Your garden: a raised lawn behind a fence, four gates, paths to a little square in the middle.
  const midX = [19, 20];
  const midY = [13, 14];
  for (let y = GARDEN.y0; y <= GARDEN.y1; y++)
    for (let x = GARDEN.x0; x <= GARDEN.x1; x++) {
      const edge = x === GARDEN.x0 || x === GARDEN.x1 || y === GARDEN.y0 || y === GARDEN.y1;
      const cross = midX.includes(x) || midY.includes(y);
      set(x, y, edge ? (cross ? "gate" : "fence") : cross ? "path" : "garden");
    }
  // Key beds: every other tile in each corner of the garden, nearest the square first.
  const plots: Tile[] = [];
  for (const [qx, qy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const)
    for (const [dx, dy] of [[1, 1], [3, 1], [1, 3], [3, 3]] as const) {
      const x = qx > 0 ? 20 + dx : 19 - dx;
      const y = qy > 0 ? 14 + dy : 13 - dy;
      if (get(x, y) === "garden") (set(x, y, "plot"), plots.push({ x, y }));
    }
  // Paths from the gates out to the ring road.
  for (const x of midX) for (let y = RING.y0 + 1; y < GARDEN.y0; y++) (set(x, y, "path"), set(x, GARDEN.y1 + (y - RING.y0), "path"));
  for (const y of midY) for (let x = RING.x0 + 1; x < GARDEN.x0; x++) (set(x, y, "path"), set(GARDEN.x1 + (x - RING.x0), y, "path"));

  // The neighbours' beds, on the band between the ring road and the garden fence.
  const beds: Tile[] = [];
  for (let y = RING.y0 + 1; y < RING.y1; y++)
    for (let x = RING.x0 + 1; x < RING.x1; x++) {
      if (get(x, y) !== "lawn") continue;
      const middleOfBand = x === RING.x0 + 2 || x === RING.x1 - 2 || y === RING.y0 + 2 || y === RING.y1 - 2;
      const byAPath = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => get(x + dx, y + dy) === "path");
      if (middleOfBand && (x + y) % 2 === 0 && !byAPath) (set(x, y, "bed"), beds.push({ x, y }));
    }
  // Nearest the garden's front corner (the bottom of the screen) first.
  const front = { x: GARDEN.x1 + 1, y: GARDEN.y1 + 1 };
  beds.sort((a, b) => Math.abs(a.x - front.x) + Math.abs(a.y - front.y) - (Math.abs(b.x - front.x) + Math.abs(b.y - front.y)) || a.x - b.x);

  // Places: their footprints, and a path from each door to the ring road.
  for (const p of places) {
    const { x, y, w, h } = p.footprint;
    if (p.id !== "garden")
      for (let j = y; j < y + h; j++)
        for (let i = x; i < x + w; i++) {
          if (p.terrain === "water") set(i, j, "water");
        }
    // Straight to the ring road, or round the corner (along x, then y) from a door off a corner.
    for (const door of p.doors) {
      for (let t = { ...door }; !inRect(t.x, t.y, RING); ) {
        set(t.x, t.y, "path");
        if (t.x < RING.x0) t.x++;
        else if (t.x > RING.x1) t.x--;
        else if (t.y < RING.y0) t.y++;
        else t.y--;
      }
    }
  }

  // Trees, bushes and flowers on the open lawn outside the ring; lantern posts along the road.
  const decor: Decor[] = [];
  const near = (x: number, y: number, what: (t: Terrain) => boolean) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => what(get(x + dx, y + dy))));
  // Keep clear of every place's plot, whether or not it's on this viewer's map.
  const nearPlace = (x: number, y: number) =>
    places.some((p) => x >= p.footprint.x - 2 && x < p.footprint.x + p.footprint.w + 2 && y >= p.footprint.y - 2 && y < p.footprint.y + p.footprint.h + 2);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (get(x, y) !== "lawn" || inRect(x, y, RING) || blocked.has(at(x, y))) continue;
      if (near(x, y, (t) => t === "path" || t === "water") || nearPlace(x, y)) {
        if (get(x, y) === "lawn" && hash(x, y, 5) < 0.12 && !nearPlace(x, y)) decor.push({ kind: "flowers", tile: { x, y } });
        continue;
      }
      const r = hash(x, y, 3);
      const byHedge = near(x, y, (t) => t === "hedge");
      const kind: DecorKind | null = r < (byHedge ? 0.34 : 0.1) ? (hash(x, y, 4) < 0.35 ? "pine" : "tree") : r < 0.2 ? "bush" : r < 0.3 ? "flowers" : null;
      if (!kind) continue;
      decor.push({ kind, tile: { x, y } });
      if (kind !== "flowers") blocked.add(at(x, y));
    }
  for (const [x, y] of [[RING.x0 - 1, RING.y0 - 1], [RING.x1 + 1, RING.y0 - 1], [RING.x0 - 1, RING.y1 + 1], [RING.x1 + 1, RING.y1 + 1], [18, RING.y1 + 1], [21, RING.y0 - 1], [RING.x0 - 1, 12], [RING.x1 + 1, 15]] as const) {
    if (get(x, y) !== "lawn" || blocked.has(at(x, y))) continue;
    decor.push({ kind: "lantern", tile: { x, y } });
    blocked.add(at(x, y));
  }
  // Flowers on the band where no bed is.
  for (let y = RING.y0 + 1; y < RING.y1; y++)
    for (let x = RING.x0 + 1; x < RING.x1; x++) if (get(x, y) === "lawn" && !inRect(x, y, GARDEN) && hash(x, y, 7) < 0.18) decor.push({ kind: "flowers", tile: { x, y } });

  return {
    width: MAP_W,
    height: MAP_H,
    terrainAt: get,
    walkable: (x, y) => WALKABLE[get(x, y)] && !blocked.has(at(x, y)),
    // Walks keep to the roads: a lawn tile costs three road tiles.
    cost: (x, y) => (["path", "gate"].includes(get(x, y)) ? 1 : 3),
    spawn: { x: midX[0], y: midY[0] },
    beds,
    plots,
    decor,
  };
}

/**
 * The world every viewer walks. Every place keeps its path and its plot of lawn, but a building
 * only stands (and blocks the way) where it's on your map: see `walkGrid`.
 */
export const WORLD = buildWorld(PLACES);

/** The walkable grid with the buildings on your map standing on their footprints. */
export function walkGrid(places: PlaceDef[], world: World = WORLD): World {
  const blocked = new Set<string>();
  for (const p of places) {
    if (p.walkable || p.terrain === "water") continue;
    const { x, y, w, h } = p.footprint;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) blocked.add(`${i},${j}`);
  }
  return { ...world, walkable: (x, y) => world.walkable(x, y) && !blocked.has(`${x},${y}`) };
}

// ---------------------------------------------------------------------------------------------
// Ground tiles: 16 × 16 pixel maps, sampled at the map's own pixel position so neighbouring
// tiles join into one lawn, one road, one pond.

const map = (rows: string[]): PixelMap => ({ rows });

const LAWN = map([
  "gggGggggggggGggg",
  "ggggggugggggggGg",
  "gGgggggggGgggggg",
  "gggggggggggggugg",
  "ggggGgggggggggGg",
  "gugggggggGgggggg",
  "gggggggGgggggggg",
  "ggGgggggggggGggg",
  "gggggugggggggggg",
  "Gggggggggggggugg",
  "gggggggGggGggggg",
  "gggGgggggggggggg",
  "gggggggggugggGgg",
  "gGgggggggggggggg",
  "gggggGgggggGgggg",
  "ggggggggGggggggu",
]);

const GARDEN_LAWN = map([
  "uuuuguuuuuuuguuu",
  "uuguuuuuuguuuuuu",
  "uuuuuuguuuuuuugu",
  "guuuuuuuuuuguuuu",
  "uuuuuguuuuuuuuuu",
  "uuguuuuuuguuuguu",
  "uuuuuuuuuuuuuuuu",
  "uuuuguuuguuuuuug",
  "uguuuuuuuuuguuuu",
  "uuuuuuguuuuuuuuu",
  "uuuguuuuuuuuguuu",
  "uuuuuuuuuguuuuuu",
  "guuuuguuuuuuuuuu",
  "uuuuuuuuuuuguuuu",
  "uuguuuuuguuuuuug",
  "uuuuuuuuuuuuuuuu",
]);

const PATH = map([
  "PmmMPmmMPmmMPmmM",
  "mmmMmsmMmmmMmmmM",
  "mmmMmmmMmmmMmmmM",
  "MMMMMMMMMMMMMMMM",
  "mMPmmMPmmMPmmMPm",
  "mMmmmMmmmMmmmMmm",
  "mMmmmMmmmMsmmMmm",
  "MMMMMMMMMMMMMMMM",
  "PmmMPmmMPmmMPmmM",
  "mmsMmmmMmmmMmmmM",
  "mmmMmmmMmmmMmmmM",
  "MMMMMMMMMMMMMMMM",
  "mMPmmMPmmMPmmMPm",
  "mMmmmMmmmMmmmsmm",
  "mMmmmMmsmMmmmMmm",
  "MMMMMMMMMMMMMMMM",
]);

const HEDGE = map([
  "GGGGgGGGGGGGGkGG",
  "GgGGGGGGkGGGGGGG",
  "GGGGGGGGGGGgGGGG",
  "GGGkGGgGGGGGGGGG",
  "GGGGGGGGGGGGGGgG",
  "GgGGGGGGGkGGGGGG",
  "GGGGGGgGGGGGGGGG",
  "kGGGGGGGGGGGgGGG",
  "GGGGgGGGGGGGGGGG",
  "GGGGGGGGGGkGGGGG",
  "GGgGGGGGGGGGGGgG",
  "GGGGGGkGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GkGGGGGGgGGGkGGG",
  "GGGGgGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGk",
]);

const SOIL = map([
  "ssssssssssssssss",
  "sbssssssbsssssss",
  "ssssssssssssssbs",
  "ssssbsssssssssss",
  "ssssssssssbsssss",
  "sbssssssssssssss",
  "ssssssbsssssssss",
  "sssssssssssssbss",
  "ssbsssssssssssss",
  "sssssssssbssssss",
  "ssssssssssssssss",
  "bsssssbsssssssss",
  "sssssssssssssbss",
  "ssssbsssssssssss",
  "ssssssssssbsssss",
  "ssssssssssssssss",
]);

const WATER_A = map([
  "WWWWWWWWWWWWWWWW",
  "WWWWwwWWWWWWWWWW",
  "WWWWWWWWWWWWcWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWWwwwWWWW",
  "WcWWWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWwwWWWWWWWW",
  "WWWWWWWWWWWWWWww",
  "WWWWWWWWWWcWWWWW",
  "WWwwWWWWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWwwWWWWWW",
  "WWWWcWWWWWWWWWWW",
  "WWWWWWWWWWWWWwwW",
  "WWWWWWWWWWWWWWWW",
]);

const WATER_B = map([
  "WWWWWWWWWWWWWWWW",
  "WWWWWwwWWWWWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWWWWcWWWW",
  "WWWWWWWWWWwwwWWW",
  "WWWWWWWWWWWWWWWW",
  "WWcWWWWWWWWWWWWW",
  "WWWWWWWwwWWWWWWW",
  "wWWWWWWWWWWWWWWw",
  "WWWWWWWWWWWWWWWW",
  "WWWwwWWWWWcWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWWWWWwwWWWWW",
  "WWWWWWWWWWWWWWWW",
  "WWWWWcWWWWWWWWwW",
  "WWWWWWWWWWWWWWWW",
]);

/** The pixel maps each kind of ground is drawn with; water has two frames. */
export const GROUND = {
  lawn: [LAWN],
  garden: [GARDEN_LAWN],
  path: [PATH],
  hedge: [HEDGE],
  soil: [SOIL],
  water: [WATER_A, WATER_B],
} satisfies Record<string, PixelMap[]>;

export type GroundKind = keyof typeof GROUND;

/** Which ground a terrain is drawn with (void is the sky). */
export const GROUND_OF: Record<Terrain, GroundKind | null> = {
  void: null,
  hedge: "hedge",
  lawn: "lawn",
  path: "path",
  water: "water",
  garden: "garden",
  fence: "garden",
  gate: "path",
  plot: "soil",
  bed: "soil",
};

/** How long the water holds each of its two frames: a slow shimmer. */
export const SHIMMER_MS = 1200;

/** The water frame showing at a time. */
export function groundFrame(ms: number) {
  return Math.floor(ms / SHIMMER_MS) % 2;
}

// ---------------------------------------------------------------------------------------------
// Things that stand on the ground: our own trees, bushes, lanterns, flowers and plants.

function roundTree() {
  const c = new PixelCanvas(18, 26);
  c.rect(8, 16, 3, 9, "b").rect(8, 16, 1, 9, "s");
  c.disc(9, 11, 8, "G").disc(7, 9, 5, "g").disc(11, 7, 4, "g").disc(6, 6, 2, "u");
  return c.outline().map();
}

function pine() {
  const c = new PixelCanvas(16, 28);
  c.rect(7, 21, 2, 6, "b");
  for (let tier = 0; tier < 4; tier++) {
    const top = 2 + tier * 5;
    c.polygon([[8, top], [14 - tier + tier * 1, top + 8], [2 + tier - tier * 1, top + 8]], tier % 2 ? "G" : "g");
  }
  c.set(8, 2, "u").set(7, 4, "u");
  return c.outline().map();
}

function bush() {
  const c = new PixelCanvas(14, 10);
  c.disc(5, 6, 4, "G").disc(9, 6, 4, "G").disc(6, 5, 3, "g").set(5, 3, "u").set(9, 4, "u");
  return c.outline().map();
}

function lanternPost() {
  const c = new PixelCanvas(9, 22);
  c.rect(4, 6, 1, 15, "b").rect(3, 20, 3, 1, "b");
  c.rect(2, 2, 5, 5, "b").rect(3, 3, 3, 3, "l").set(4, 4, "c").rect(3, 1, 3, 1, "b");
  return c.outline().map();
}

function flowers(seed: number) {
  const c = new PixelCanvas(12, 6);
  const colours = ["v", "l", "c", "e", "p"];
  for (let i = 0; i < 4; i++) {
    const x = 1 + Math.floor(hash(seed, i, 11) * 10);
    const y = 1 + Math.floor(hash(seed, i, 12) * 4);
    c.set(x, y + 1, "G").set(x, y, colours[Math.floor(hash(seed, i, 13) * colours.length)]);
  }
  return c.map();
}

/** A sprout in a neighbour's bed; the garden lane grows these into real plants. */
function sprout() {
  const c = new PixelCanvas(10, 11);
  c.rect(4, 4, 2, 6, "g").rect(1, 3, 3, 2, "u").rect(6, 2, 3, 2, "u").rect(3, 1, 2, 2, "u");
  return c.outline().map();
}

/** One of your plants on a key bed, by its stage (seed, sprout, young, grown, in fruit). */
function plant(stage: number) {
  const c = new PixelCanvas(16, 20);
  const h = 4 + stage * 3;
  c.rect(7, 19 - h, 2, h, "G");
  c.disc(8, 19 - h, 2 + stage, "g").disc(7, 18 - h, 1 + stage / 2, "u");
  if (stage >= 3) c.set(5, 17 - h, "l").set(11, 18 - h, "l").set(8, 15 - h, "e");
  return c.outline().map();
}

export const DECOR_SPRITES = {
  tree: roundTree(),
  pine: pine(),
  bush: bush(),
  lantern: lanternPost(),
  flowers: [0, 1, 2, 3].map(flowers),
  sprout: sprout(),
  plants: [0, 1, 2, 3, 4].map(plant),
};
