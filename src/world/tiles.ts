import { PixelCanvas, type PixelMap } from "./pixels";
import type { Terrain } from "./world";

/**
 * The world's small pixel art (#126, #156): the ground tiles every terrain is drawn with (the
 * desert's sand, dunes and rock, the tree's lawn, paths, water) and the small things that stand on
 * it (lanterns, flowers, base camp's tents, a district's marker). All ours, drawn in code
 * in the palette; the places draw their own buildings (`places/`), the tree its own (`tree/`).
 */

/** A stable pseudo-random number in [0, 1) for a tile or a pixel, so the world looks the same every visit. */
export function hash(x: number, y: number, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------------------------
// Ground tiles: 16 × 16 pixel maps, sampled at the map's own pixel position so neighbouring
// tiles join into one lawn, one road, one pond, one sea of sand.

/** A 16 × 16 texture from a rule per pixel. */
const texture = (rule: (x: number, y: number) => string): PixelMap => ({
  rows: Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => rule(x, y)).join("")),
});

/** Sand: pale, with a few darker grains and the odd pebble. */
const SAND = texture((x, y) => {
  const r = hash(x, y, 61);
  return r < 0.04 ? "D" : r < 0.2 ? "A" : "a";
});
/** A dune's windward face: deeper sand with pale wind ripples running along it. */
const DUNE = texture((x, y) => ((x + 2 * y) % 8 === 0 ? "a" : hash(x, y, 62) < 0.1 ? "D" : "A"));
/** A dune's lee, in its own shadow. */
const RIDGE = texture((x, y) => ((x + 2 * y) % 8 === 4 ? "A" : hash(x, y, 63) < 0.12 ? "n" : "D"));
/** The top of an outcrop: weathered sandstone with its cracks. */
const ROCK = texture((x, y) => ((x * 3 + y * 5) % 11 === 0 ? "b" : hash(x, y, 64) < 0.25 ? "A" : "D"));

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
  sand: [SAND],
  dune: [DUNE],
  ridge: [RIDGE],
  rock: [ROCK],
  lawn: [LAWN],
  garden: [GARDEN_LAWN],
  path: [PATH],
  soil: [SOIL],
  water: [WATER_A, WATER_B],
} satisfies Record<string, PixelMap[]>;

export type GroundKind = keyof typeof GROUND;

/** Which ground a terrain is drawn with. */
export const GROUND_OF: Record<Terrain, GroundKind> = {
  sand: "sand",
  dune: "dune",
  ridge: "ridge",
  rock: "rock",
  water: "water",
  oasis: "lawn",
  lawn: "lawn",
  path: "path",
  garden: "garden",
  fence: "garden",
  gate: "path",
  plot: "soil",
  bed: "soil",
};

/** How high raised ground stands, in art pixels: the terrace, and the desert's rock. */
export const LIFT: Partial<Record<Terrain, number>> = { garden: 3, fence: 3, gate: 3, plot: 3, rock: 6 };

/**
 * The world at dusk (#152 "night-sand"): the colour a pixel of ground takes in a pool of warm light
 * (by a lantern, under the tree), out past the tree's light (dusk), and far out in the night.
 */
export const WARM: Record<string, string> = { a: "P", A: "a", D: "A", n: "D", g: "u", G: "g", m: "P", M: "m", s: "B" };
export const DUSK: Record<string, string> = { a: "A", A: "D", D: "n", n: "b", P: "A", g: "G", u: "g", m: "M", s: "b", w: "W", p: "P" };
export const NIGHT: Record<string, string> = { a: "n", A: "n", D: "b", n: "b", P: "n", g: "G", u: "G", m: "M", M: "b", s: "b", w: "W", p: "D" };

/** How long the water holds each of its two frames: a slow shimmer. */
export const SHIMMER_MS = 1200;

// ---------------------------------------------------------------------------------------------
// Small things that stand on the ground.

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

/** A traveller's tent: parchment canvas over a pole, an ember stripe, its flap open. */
function tent() {
  const c = new PixelCanvas(22, 18);
  c.polygon([[11, 1], [21, 15], [1, 15]], "p");
  c.polygon([[11, 1], [21, 15], [13, 15]], "P");
  c.polygon([[11, 5], [14, 15], [8, 15]], "k");
  c.polygon([[11, 5], [12, 15], [10, 15]], "b");
  c.rect(4, 11, 3, 1, "e").rect(16, 11, 3, 1, "E");
  c.set(11, 0, "b").set(11, 1, "b");
  return c.outline().map();
}

/** A district that's open but has nothing to walk into yet: a post with a painted plaque. */
function marker() {
  const c = new PixelCanvas(14, 22);
  c.rect(6, 7, 2, 14, "b").rect(6, 7, 1, 14, "s");
  c.rect(1, 2, 12, 7, "p").rect(1, 8, 12, 1, "P").rect(3, 4, 8, 1, "s").rect(3, 6, 5, 1, "s");
  return c.outline().map();
}

export const DECOR_SPRITES = {
  lantern: lanternPost(),
  flowers: [0, 1, 2, 3].map(flowers),
  sprout: sprout(),
  tent: tent(),
  marker: marker(),
};
