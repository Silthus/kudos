import { fnv1a, mulberry32 } from "../../../convex/lib/random";
import { stageIndex, type TreeStageId } from "../../../convex/lib/tree";
import { PixelCanvas, type PixelMap } from "../pixels";

/**
 * The Ancient Tree of Appreciation (#152 §S1, #156): the hero of the world, our own pixel art in the
 * dusk palette with the tree's own tokens (bark-light, sap). Drawn in code per stage, from a seed
 * that is the workspace's, so no two companies' trees grow quite alike: the lean of the trunk, where
 * the branches fork, where the lanterns hang.
 *
 * A seed is a glowing kernel half-buried in the sand; a sprout two leaves; a sapling a thin stem with
 * a few tufts. From the young tree on it's a real tree: roots gripping the sand, a trunk lit on its
 * left in bark-light with a seam of sap running up it, branches forking into a canopy of lit and
 * shaded leaf clusters, and lanterns hanging from its lower edge, more at every stage. Past the world
 * tree each ring makes it a little taller and hangs more lanterns.
 *
 * The sprite stands with its bottom centre on the trunk's front corner.
 */

type Params = { w: number; h: number; trunkH: number; trunkW: number; canopy: number; clusters: number; lanterns: number; sap: number; roots: number };

/** From the young tree up: size, trunk, canopy radius, clusters of leaves, lanterns and sap-lit specks. */
const TREES: Partial<Record<TreeStageId, Params>> = {
  young: { w: 74, h: 96, trunkH: 34, trunkW: 9, canopy: 27, clusters: 11, lanterns: 3, sap: 6, roots: 4 },
  grown: { w: 104, h: 132, trunkH: 46, trunkW: 12, canopy: 38, clusters: 16, lanterns: 5, sap: 10, roots: 6 },
  great: { w: 128, h: 156, trunkH: 56, trunkW: 14, canopy: 46, clusters: 20, lanterns: 7, sap: 16, roots: 6 },
  ancient: { w: 152, h: 182, trunkH: 64, trunkW: 17, canopy: 55, clusters: 25, lanterns: 10, sap: 22, roots: 8 },
  elder: { w: 176, h: 206, trunkH: 72, trunkW: 19, canopy: 63, clusters: 30, lanterns: 12, sap: 28, roots: 8 },
  world_tree: { w: 210, h: 244, trunkH: 84, trunkW: 23, canopy: 76, clusters: 38, lanterns: 16, sap: 38, roots: 10 },
};

/** A mound of sand the seed and the sprout sit in, its crest lit, its front in shade. */
function mound(c: PixelCanvas, cx: number, base: number, rx: number, ry: number) {
  for (let y = base - ry; y <= base; y++)
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - base) / ry;
      if (dx * dx + dy * dy > 1) continue;
      c.set(x, y, dy < -0.55 ? "a" : dx > 0.3 ? "D" : "A");
    }
}

/** The seed as it stands once planted: the last frame of the seed moment. */
const seed = (): PixelMap => SEED_FRAMES[SEED_FRAMES.length - 1];

function sprout(): PixelMap {
  const c = new PixelCanvas(22, 24);
  mound(c, 11, 22, 10, 5);
  c.rect(10, 9, 2, 11, "g").rect(10, 9, 1, 11, "u");
  // Two leaves open to the light, a bud of sap between them.
  c.polygon([[10, 12], [3, 8], [5, 13]], "g").polygon([[10, 12], [4, 9], [6, 11]], "u");
  c.polygon([[12, 10], [19, 5], [17, 11]], "g").polygon([[12, 10], [18, 6], [16, 8]], "u");
  c.rect(10, 7, 2, 2, "y").set(10, 7, "c");
  return c.outline().map();
}

/** A shaded clump of leaves: lit from the upper left, shaded underneath, with a little texture. */
function blob(c: PixelCanvas, cx: number, cy: number, r: number, rand: () => number, salt: number) {
  const bump = 0.9 + rand() * 0.6;
  for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++)
    for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      // A leafy edge: the rim goes in and out with the angle.
      const edge = r + Math.sin(Math.atan2(dy, dx) * 5 + salt) * bump;
      if (d > edge) continue;
      const light = (-dx * 0.55 - dy * 0.85) / r;
      const n = ((x * 73856093) ^ (y * 19349663) ^ salt) >>> 0;
      let colour = light > 0.42 ? "u" : light < -0.3 ? "G" : "g";
      if (n % 17 === 0) colour = colour === "u" ? "g" : colour === "g" ? (light > 0 ? "u" : "G") : "g";
      if (d > edge - 1 && light < -0.1) colour = "G";
      // A dark rim under each clump, so the canopy reads as clumps of leaves, not one blob.
      if (d > edge - 1.4 && light < -0.45) colour = "k";
      c.set(x, y, colour);
    }
}

/** A limb from (x, y) at an angle, tapering; its upper edge lit. Returns where it ends. */
function limb(c: PixelCanvas, x: number, y: number, angle: number, length: number, thick: number) {
  const steps = Math.ceil(length);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x + Math.cos(angle) * length * t;
    const py = y + Math.sin(angle) * length * t;
    const r = Math.max(0.6, thick * (1 - t * 0.6)) / 2;
    for (let j = Math.floor(py - r); j <= py + r; j++)
      for (let k = Math.floor(px - r); k <= px + r; k++) {
        if ((k + 0.5 - px) ** 2 + (j + 0.5 - py) ** 2 > r * r + 0.3) continue;
        c.set(k, j, j + 0.5 < py - r * 0.3 ? "B" : "s");
      }
  }
  return { x: x + Math.cos(angle) * length, y: y + Math.sin(angle) * length };
}

function sapling(rand: () => number): PixelMap {
  const c = new PixelCanvas(34, 46);
  mound(c, 17, 44, 12, 4);
  // A thin stem, leaning a little, lit on its left.
  const lean = (rand() - 0.5) * 3;
  for (let y = 18; y <= 42; y++) {
    const x = Math.round(16 + lean * (1 - (y - 18) / 24));
    c.set(x, y, "B").set(x + 1, y, "s");
  }
  limb(c, 17 + lean, 26, -2.5, 8, 2);
  limb(c, 17 + lean, 22, -0.6, 8, 2);
  blob(c, 9 + lean, 20, 5, rand, 3);
  blob(c, 25 + lean, 16, 5, rand, 5);
  blob(c, 17 + lean, 11, 7, rand, 7);
  c.set(16, 8, "y").set(22, 14, "y");
  return c.outline().map();
}

function fullTree(p: Params, rand: () => number, rings: number): PixelMap {
  const grow = 1 + Math.min(4, rings) * 0.06;
  const w = Math.round(p.w * grow);
  const h = Math.round(p.h * grow);
  const c = new PixelCanvas(w, h);
  const cx = w / 2;
  const base = h - 4;
  const trunkH = p.trunkH * grow;
  const trunkW = p.trunkW * grow;
  const phase = rand() * Math.PI * 2;
  const sway = (0.15 + rand() * 0.2) * trunkW;
  const centre = (t: number) => cx + Math.sin(t * Math.PI * 1.2 + phase) * sway - Math.sin(phase) * sway;

  // Roots gripping the sand, running off along the ground both ways.
  for (let i = 0; i < p.roots; i++) {
    const side = i % 2 ? 1 : -1;
    const spread = (0.35 + rand() * 0.5) * trunkW * 1.6;
    const start = { x: cx + side * trunkW * (0.2 + rand() * 0.25), y: base - 2 - rand() * 3 };
    const steps = Math.ceil(spread);
    for (let s = 0; s <= steps; s++) {
      const x = start.x + side * s;
      const y = start.y + s * 0.5 + (rand() < 0.2 ? 1 : 0);
      const th = Math.max(1, Math.round((1 - s / steps) * 3));
      for (let j = 0; j < th; j++) c.set(Math.round(x), Math.round(y) - j, j === th - 1 ? "B" : "s");
    }
  }

  // The trunk: flared at its foot, tapering up, lit on the left, bark streaks and a seam of sap.
  const top = base - trunkH;
  for (let y = Math.floor(top); y <= base; y++) {
    const t = (base - y) / trunkH;
    const width = trunkW * (1 - 0.45 * t) + trunkW * 0.9 * (1 - t) ** 5;
    const mid = centre(t);
    for (let x = Math.floor(mid - width / 2); x <= mid + width / 2; x++) {
      const rel = (x + 0.5 - mid) / (width / 2);
      let colour = rel < -0.35 ? "B" : rel < 0.4 ? "s" : "b";
      const streak = ((Math.round(rel * 4) * 2654435761) ^ Math.floor(y / 3)) >>> 0;
      if (streak % 5 === 0 && colour !== "b" && Math.abs(rel) < 0.85) colour = colour === "B" ? "s" : "b";
      c.set(x, y, colour);
    }
    // The sap seam, winding up the lit side.
    if (t < 0.85 && p.sap >= 8) c.set(Math.round(mid - width * 0.12 + Math.sin(y * 0.35 + phase) * 1.2), y, "y");
  }
  // A knot in the bark.
  const knot = { x: Math.round(centre(0.5) + trunkW * 0.1), y: Math.round(base - trunkH * 0.5) };
  c.rect(knot.x, knot.y, 2, 3, "b").set(knot.x, knot.y + 1, "k");

  // Branches: three to five limbs from the top of the trunk, each forking twice.
  const tips: { x: number; y: number }[] = [];
  const crown = { x: centre(1), y: top + 2 };
  const limbs = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < limbs; i++) {
    const spread = (i / (limbs - 1) - 0.5) * 2.3 + (rand() - 0.5) * 0.25;
    const angle = -Math.PI / 2 + spread;
    const length = p.canopy * (0.55 + rand() * 0.3);
    const end = limb(c, crown.x, crown.y + Math.abs(spread) * trunkW * 0.8, angle, length, trunkW * 0.55);
    tips.push(end);
    for (let f = 0; f < 2; f++) {
      const fork = angle + (f ? 0.6 : -0.6) + (rand() - 0.5) * 0.3;
      const from = { x: crown.x + (end.x - crown.x) * 0.6, y: crown.y + (end.y - crown.y) * 0.6 };
      tips.push(limb(c, from.x, from.y, fork, length * (0.45 + rand() * 0.2), trunkW * 0.3));
    }
  }

  // The canopy: clumps at the branch tips and filling the crown, drawn from the back (top) down.
  const cy = top - p.canopy * 0.45;
  const clumps: { x: number; y: number; r: number }[] = tips.map((t) => ({ x: t.x, y: t.y, r: p.canopy * (0.26 + rand() * 0.12) }));
  // A full crown: a heart clump over the trunk, the rest spread evenly round it (an outer and an inner ring), a little jittered.
  clumps.push({ x: crown.x, y: cy, r: p.canopy * 0.42 });
  const fill = Math.max(0, p.clusters - clumps.length);
  for (let i = 0; i < fill; i++) {
    const outer = i % 3 !== 2;
    const a = (i / fill) * Math.PI * 2 + (rand() - 0.5) * 0.5;
    const d = p.canopy * (outer ? 0.72 : 0.38) * (0.9 + rand() * 0.2);
    clumps.push({ x: crown.x + Math.cos(a) * d * 1.15, y: cy + Math.sin(a) * d * 0.72, r: p.canopy * (0.24 + rand() * 0.14) });
  }
  clumps.sort((a, b) => a.y - b.y || a.x - b.x);
  clumps.forEach((k, i) => blob(c, k.x, k.y, k.r, rand, i * 7919));

  // Specks of sap glowing among the leaves: the tree at dusk.
  for (let i = 0; i < p.sap; i++) {
    const k = clumps[Math.floor(rand() * clumps.length)];
    const x = Math.round(k.x + (rand() - 0.5) * k.r * 1.4);
    const y = Math.round(k.y + (rand() - 0.2) * k.r);
    if (c.get(x, y) !== ".") c.set(x, y, rand() < 0.25 ? "c" : "y");
  }

  // Lanterns hanging from the canopy's lower edge, spread across it.
  for (let i = 0; i < p.lanterns + Math.min(4, rings) * 2; i++) {
    const n = p.lanterns + Math.min(4, rings) * 2;
    const x = Math.round(crown.x + ((i + 0.5) / n - 0.5) * p.canopy * 1.9 + (rand() - 0.5) * 4);
    let y = h - 1;
    while (y > 0 && c.get(x, y) === ".") y--;
    // Only under leaves, not on the trunk.
    if (!["g", "G", "u"].includes(c.get(x, y)) || Math.abs(x - crown.x) < trunkW * 0.6) continue;
    const drop = 2 + Math.floor(rand() * 4);
    c.rect(x, y + 1, 1, drop, "b");
    c.rect(x - 1, y + 1 + drop, 3, 1, "b").rect(x - 1, y + 2 + drop, 3, 3, "l").set(x, y + 3 + drop, "c");
  }
  return c.outline().map();
}

const cache = new Map<string, PixelMap>();

/** The tree at a stage for a workspace's seed, with its rings past the world tree. */
export function treeSprite(stage: TreeStageId, worldSeed: number, rings = 0): PixelMap {
  const key = `${stage}:${worldSeed}:${Math.min(4, rings)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rand = mulberry32(fnv1a(`tree-art:${worldSeed >>> 0}:${stage}`));
  const params = TREES[stage];
  const sprite = stage === "seed" ? seed() : stage === "sprout" ? sprout() : stage === "sapling" ? sapling(rand) : fullTree(params!, rand, stageIndex(stage) === 8 ? rings : 0);
  cache.set(key, sprite);
  return sprite;
}

/**
 * The seed moment (#156): six frames of the Ancient Seed sprouting, played once when the first
 * thoughtful kudos plants it. It glows on the sand, sinks in, cracks with light, a shoot comes up and
 * opens its first leaves; after the last frame the tree's own sprite stands there.
 */
export const SEED_FRAMES: PixelMap[] = (() => {
  const cx = 20;
  const base = 36;
  /** A frame: the body outlined in the pixel-art edge, then its light over it, unoutlined. */
  const frame = (body: (c: PixelCanvas) => void, light: (c: PixelCanvas) => void = () => {}) => {
    const c = new PixelCanvas(40, 38);
    body(c);
    c.outline();
    light(c);
    return c.map();
  };
  const kernel = (c: PixelCanvas, y: number) => c.rect(cx - 3, y, 6, 4, "B").rect(cx - 2, y - 1, 4, 1, "B").rect(cx + 1, y + 1, 2, 3, "s").rect(cx - 1, y + 1, 1, 2, "y");
  /** Rays of sap light out from a point, every other one short; the inner half cream when `bright`. */
  const rays = (c: PixelCanvas, y: number, len: number, bright = false) => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const l = i % 2 ? len * 0.55 : len;
      for (let r = 6; r < l; r += 2) c.set(Math.round(cx + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.6), r < l * (bright ? 0.7 : 0.4) ? "c" : "y");
    }
  };
  const sunk = (c: PixelCanvas) => {
    mound(c, cx, base, 15, 6);
    kernel(c, 28);
  };
  return [
    // It glows on the sand.
    frame((c) => kernel(c, 26), (c) => rays(c, 27, 10)),
    // It sinks in, and the sand closes round it.
    frame(sunk, (c) => rays(c, 29, 13)),
    // It cracks with light.
    frame(sunk, (c) => {
      c.rect(cx - 1, 25, 2, 6, "c").set(cx, 23, "c");
      rays(c, 28, 20, true);
    }),
    // The light settles into it.
    frame(sunk, (c) => {
      c.rect(cx - 1, 27, 1, 3, "c");
      rays(c, 28, 12);
    }),
    // The tip of a shoot.
    frame(
      (c) => {
        sunk(c);
        c.rect(cx - 1, 24, 1, 4, "g").rect(cx, 24, 1, 4, "u").set(cx + 1, 23, "u");
      },
      (c) => rays(c, 28, 9),
    ),
    // Planted: the Ancient Seed, a shoot of light in the sand.
    frame(
      (c) => {
        sunk(c);
        c.rect(cx - 1, 23, 1, 5, "g").rect(cx, 23, 1, 5, "u").rect(cx + 1, 22, 2, 1, "u");
      },
      (c) => {
        c.set(cx, 21, "y").set(cx + 3, 21, "y");
        for (const [x, y] of [[9, 20], [31, 18], [14, 13], [26, 12], [20, 8]]) c.set(x, y, "y");
      },
    ),
  ];
})();

/** How long each frame of the seed moment shows. */
export const SEED_FRAME_MS = 220;
