import { fnv1a, mulberry32 } from "../../../convex/lib/random";
import type { TreeStageId } from "../../../convex/lib/tree";
import { PixelCanvas, type PixelMap } from "../pixels";

/**
 * The Ancient Tree of Appreciation (#152 §S1, #156): the hero of the world, our own pixel art in the
 * dusk palette with the tree's own tokens (bark-light, sap). Drawn in code per stage, from a seed
 * that is the workspace's, so no two companies' trees grow quite alike: the lean of the trunk, where
 * the branches fork, where the lanterns hang.
 *
 * A seed is a glowing kernel half-buried in the sand; a sprout two leaves; a sapling a thin stem with
 * a few tufts; a young tree one round canopy on a slim trunk. From the grown tree on it is the
 * Ancient Tree (`ancientTree`): buttress roots, a trunk three tiles wide at elder, a canopy in tiers
 * over its great limbs, lanterns glowing under every tier. Past the world tree each ring makes it a
 * little bigger.
 *
 * The sprite stands with its bottom centre on the trunk's front corner.
 */

type Params = { w: number; h: number; trunkH: number; trunkW: number; canopy: number; clusters: number; lanterns: number; sap: number; roots: number };

/** The young tree: size, trunk, canopy radius, clusters of leaves, lanterns and sap-lit specks. */
const YOUNG: Params = { w: 74, h: 96, trunkH: 34, trunkW: 9, canopy: 27, clusters: 11, lanterns: 3, sap: 6, roots: 4 };

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

/** The young tree: one round canopy on a slim trunk, a lantern or three. */
function youngTree(p: Params, rand: () => number, rings: number): PixelMap {
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

/**
 * The Ancient Tree from the grown stage up: a trunk three tiles wide at elder, flared into buttress
 * roots that run off into the ground, its bark lit in bark-light down the left and shaded in
 * dusk-deep down the right, a vein of sap glowing up it and out along the roots. Great limbs fork
 * from its crown into a canopy of two or three tiers, the limbs showing in the gaps between them;
 * the lowest tier spreads widest and droops at its flanks over base camp. Lanterns hang under each
 * tier and light the leaves round them.
 */
type Ancient = { trunkW: number; trunkH: number; spread: number; tiers: number; lanterns: number; roots: number; sap: number };

const ANCIENT: Partial<Record<TreeStageId, Ancient>> = {
  grown: { trunkW: 30, trunkH: 44, spread: 64, tiers: 2, lanterns: 6, roots: 6, sap: 14 },
  great: { trunkW: 36, trunkH: 50, spread: 80, tiers: 2, lanterns: 9, roots: 8, sap: 20 },
  ancient: { trunkW: 42, trunkH: 56, spread: 96, tiers: 3, lanterns: 12, roots: 8, sap: 28 },
  elder: { trunkW: 50, trunkH: 62, spread: 112, tiers: 3, lanterns: 16, roots: 10, sap: 36 },
  world_tree: { trunkW: 58, trunkH: 70, spread: 128, tiers: 3, lanterns: 20, roots: 12, sap: 46 },
};

/** A glowing lantern hung on a string from (x, y): its light warms the leaves round it. */
function lantern(c: PixelCanvas, x: number, y: number, drop: number) {
  for (let j = -5; j <= 5; j++)
    for (let i = -5; i <= 5; i++) {
      const d = Math.hypot(i, j * 1.2);
      if (d > 5 || (i + j) % 2 !== 0) continue;
      const under = c.get(x + i, y + drop + 3 + j);
      if (under === "G" || under === "g" || under === "k") c.set(x + i, y + drop + 3 + j, d < 3 ? "l" : "u");
    }
  c.rect(x, y, 1, drop, "b");
  c.rect(x - 1, y + drop, 3, 1, "b").rect(x - 1, y + drop + 1, 3, 4, "l").rect(x, y + drop + 2, 1, 2, "c").rect(x - 1, y + drop + 5, 3, 1, "E");
}

function ancientTree(p: Ancient, rand: () => number, rings: number): PixelMap {
  const grow = 1 + Math.min(4, rings) * 0.06;
  const spread = Math.round(p.spread * grow);
  const trunkW = p.trunkW * grow;
  const trunkH = p.trunkH * grow;
  const tierGap = 44 * grow;
  const w = spread * 2 + 24;
  const h = Math.round(trunkH + (p.tiers - 1) * tierGap + 40 * grow);
  const c = new PixelCanvas(w, h);
  const cx = w / 2;
  const base = h - 6;
  const top = base - trunkH;
  const phase = rand() * Math.PI * 2;
  const lean = (rand() - 0.5) * trunkW * 0.3;
  const centre = (t: number) => cx + lean * t + Math.sin(t * Math.PI + phase) * trunkW * 0.06;
  const widthAt = (t: number) => trunkW * (0.62 - 0.12 * t) + trunkW * 0.75 * (1 - t) ** 4;

  // Roots: thick at the trunk, running off along the ground both ways and sinking into it.
  const sapRoots: { x: number; y: number }[] = [];
  for (let i = 0; i < p.roots; i++) {
    const side = i % 2 ? 1 : -1;
    const reach = trunkW * (0.9 + rand() * 1.0);
    const x0 = cx + side * trunkW * (0.15 + rand() * 0.3);
    const y0 = base - 3 - rand() * 4;
    const drop = 0.35 + rand() * 0.25;
    for (let s = 0; s <= reach; s++) {
      const t = s / reach;
      const th = Math.max(1, Math.round((1 - t) * (4 + trunkW * 0.08)));
      const x = Math.round(x0 + side * s);
      const y = Math.round(y0 + s * drop + Math.sin(s * 0.3 + i) * 0.8);
      for (let j = 0; j < th; j++) c.set(x, y - j, j === th - 1 ? "B" : j === 0 ? "b" : "s");
      if (i < 4 && s % 3 === 0 && t < 0.8) sapRoots.push({ x, y: y - Math.floor(th / 2) });
    }
  }

  // The trunk: flared at its foot, lit in bark-light on the left, dusk-deep in its fissures on the right.
  for (let y = Math.floor(top - 4); y <= base; y++) {
    const t = Math.max(0, (base - y) / trunkH);
    const width = widthAt(Math.min(1, t));
    const mid = centre(Math.min(1, t));
    for (let x = Math.floor(mid - width / 2); x <= mid + width / 2; x++) {
      const rel = (x + 0.5 - mid) / (width / 2);
      let colour = rel < -0.55 ? "B" : rel < -0.1 ? "s" : rel < 0.55 ? "b" : "k";
      // Fissures: dark seams running up the bark, wavering.
      const seam = Math.round((x - mid) / 4 + Math.sin(y * 0.18 + x) * 0.6);
      if (Math.abs((x - mid) / 4 - seam) < 0.18 && rel > -0.9 && rel < 0.9) colour = colour === "B" ? "s" : "k";
      c.set(x, y, colour);
    }
  }
  // Knots and a hollow in the flare.
  const hollow = { x: Math.round(centre(0.15) + trunkW * 0.12), y: Math.round(base - trunkH * 0.18) };
  c.rect(hollow.x - 2, hollow.y - 4, 5, 6, "k").rect(hollow.x - 1, hollow.y - 5, 3, 1, "k");
  c.rect(Math.round(centre(0.55) - trunkW * 0.1), Math.round(base - trunkH * 0.55), 3, 3, "k");

  // The tiers: the lowest widest and lowest-hanging, each higher one narrower, with open air between
  // them where the great limbs show.
  const tierY = (k: number) => top - 6 - k * tierGap;
  const halfOf = (k: number) => spread * (1 - k * 0.27);
  const crown = { x: centre(1), y: top };

  // A leader carries on up the middle to the top tier; great limbs fork out and up to each tier.
  limb(c, crown.x, crown.y + 2, -Math.PI / 2, top - tierY(p.tiers - 1) + 6, trunkW * 0.42);
  for (let k = 0; k < p.tiers; k++) {
    const half = halfOf(k);
    for (const side of [-1, 1]) {
      const from = { x: crown.x + side * trunkW * 0.15, y: crown.y + 4 - k * tierGap * 0.55 };
      const to = { x: crown.x + side * half * (0.55 + rand() * 0.15), y: tierY(k) + 2 };
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const end = limb(c, from.x, from.y, angle, Math.hypot(to.x - from.x, to.y - from.y), trunkW * (0.34 - k * 0.07));
      // A fork near the end, and a twig.
      limb(c, end.x - side * 6, end.y + 2, angle + side * 0.5, half * 0.25, trunkW * 0.12);
      limb(c, from.x + (end.x - from.x) * 0.55, from.y + (end.y - from.y) * 0.55, angle - side * 0.6, half * 0.18, trunkW * 0.1);
    }
  }

  // The sap vein: winding up the lit side of the trunk, out along the roots, sparking here and there.
  for (let y = Math.floor(top + 4); y <= base - 2; y++) {
    const t = (base - y) / trunkH;
    const x = Math.round(centre(t) - widthAt(t) * 0.18 + Math.sin(y * 0.22 + phase) * 2);
    c.set(x, y, "y");
    if (y % 9 === 0) c.set(x + 1, y, "c");
  }
  for (const r of sapRoots) if (c.get(r.x, r.y) !== ".") c.set(r.x, r.y, "y");

  // Each tier: a flat spread of clumps, the front row drooping at the flanks (most on the lowest
  // tier, over base camp), a few clumps on top in the middle to round it.
  for (let k = p.tiers - 1; k >= 0; k--) {
    const half = halfOf(k);
    const r = (12 - k * 1.5) * grow;
    const count = Math.max(4, Math.round((half * 2) / (r * 1.25)));
    const clumps: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i <= count; i++) {
      const u = i / count - 0.5;
      const droop = (k === 0 ? 22 : 8) * grow * Math.abs(u * 2) ** 1.7;
      clumps.push({ x: crown.x + u * 2 * (half - r * 0.7) + (rand() - 0.5) * r * 0.4, y: tierY(k) + droop + (rand() - 0.5) * 3, r: r * (0.9 + rand() * 0.25) });
      if (Math.abs(u) < 0.36) clumps.push({ x: crown.x + u * 2 * (half - r) * 0.9 + (rand() - 0.5) * r, y: tierY(k) - r * 0.75 + (rand() - 0.5) * 3, r: r * (0.8 + rand() * 0.2) });
    }
    clumps.sort((a, b) => a.y - b.y);
    clumps.forEach((q, i) => blob(c, q.x, q.y, q.r, rand, k * 1009 + i * 7919));
  }

  // Specks of sap among the leaves.
  for (let i = 0; i < p.sap; i++) {
    const k = Math.floor(rand() * p.tiers);
    const x = Math.round(crown.x + (rand() - 0.5) * halfOf(k) * 1.8);
    const y = Math.round(tierY(k) + (rand() - 0.5) * 14);
    if (["g", "G", "u"].includes(c.get(x, y))) c.set(x, y, rand() < 0.3 ? "c" : "y");
  }

  // Lanterns hung under each tier, spread across it, the most under the lowest.
  let lit = 0;
  for (let k = 0; k < p.tiers; k++) {
    const count = k === 0 ? Math.ceil(p.lanterns * 0.5) : Math.floor((p.lanterns * 0.5) / (p.tiers - 1));
    const half = halfOf(k);
    for (let i = 0; i < count && lit < p.lanterns; i++) {
      const x = Math.round(crown.x + ((i + 0.5) / count - 0.5) * 2 * half * 0.86 + (rand() - 0.5) * 4);
      if (Math.abs(x - crown.x) < trunkW * 0.5) continue;
      // The tier's underside above the lantern: the lowest leaf in this column near the tier.
      let y = Math.round(tierY(k) + 34 * grow);
      while (y > tierY(k) - 10 && !["g", "G", "u", "k"].includes(c.get(x, y))) y--;
      if (y <= tierY(k) - 10) continue;
      lantern(c, x, y + 1, 2 + Math.floor(rand() * 4));
      lit++;
    }
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
  const ancient = ANCIENT[stage];
  const sprite =
    stage === "seed"
      ? seed()
      : stage === "sprout"
        ? sprout()
        : stage === "sapling"
          ? sapling(rand)
          : ancient
            ? ancientTree(ancient, rand, stage === "world_tree" ? rings : 0)
            : youngTree(YOUNG, rand, 0);
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
