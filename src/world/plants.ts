import type { SpeciesId, StageKey } from "../../convex/lib/garden";
import { PixelCanvas, type PixelMap } from "./pixels";

/**
 * Our own pixel plants (#129, #126 "Pixels are honest"): a keyboard-key bed (the Keyboard garden's
 * idea, in pixels: an isometric key with soil on top) and the plant for its stage and species,
 * drawn in code as a 32 × 32 palette-indexed map. Seed, sprout and sapling look alike for every
 * species but for their colours; from Young on each species grows one of five canopy shapes in its
 * own leaf, deep, trunk and blossom colours. Dormant plants turn autumn and stop blossoming; fruit is
 * gold on the crown (up to four); golden leaves from Super kudos hang on it (up to three); an
 * Ancient plant wears a ring of lantern light.
 *
 * The same drawing serves `PlantArt` (windows, memories, cosmetics), the key beds on the map and the
 * small plants in the neighbours' beds (`mini`). Never a hedgehog.
 */

export const PLANT_SIZE = 32;

type Canopy = "round" | "cone" | "flower" | "fronds" | "weeping";
type Look = { canopy: Canopy; leaf: string; deep: string; trunk?: string; blossom?: string };

/** Each species' shape and colours (from #101's Keyboard-garden plants). */
export const LOOKS: Record<SpeciesId, Look> = {
  helpful_oak: { canopy: "round", leaf: "#4fca7d", deep: "#219c86" },
  kind_maple: { canopy: "round", leaf: "#e0663a", deep: "#a8402a" },
  steady_birch: { canopy: "round", leaf: "#a3d977", deep: "#5fa640", trunk: "#e8e2d4" },
  generous_cherry: { canopy: "round", leaf: "#2e8a55", deep: "#1c5c38", trunk: "#6b2f2a", blossom: "#f7a8c8" },
  wise_ginkgo: { canopy: "round", leaf: "#e9d449", deep: "#b7a22d" },
  patient_pine: { canopy: "cone", leaf: "#2f8f5b", deep: "#1f6b44" },
  brave_cedar: { canopy: "cone", leaf: "#5f8f8a", deep: "#3b615d", trunk: "#6e4a32" },
  bright_sunflower: { canopy: "flower", leaf: "#f7c325", deep: "#3f8f4f" },
  curious_fern: { canopy: "fronds", leaf: "#58b368", deep: "#2f7d45" },
  golden_willow: { canopy: "weeping", leaf: "#c9d65a", deep: "#8f9c32" },
};

const AUTUMN = { leaf: "#cf7d17", deep: "#9a5a14" };

export const lookOf = (species: string): Look => (Object.hasOwn(LOOKS, species) ? LOOKS[species as SpeciesId] : LOOKS.helpful_oak);

/** Where the plant meets the soil: the middle of the key's top. */
const BASE = 22;
const MID = 16;
const STAGE_ORDER: StageKey[] = ["seed", "sprout", "sapling", "young", "grown", "blossoming", "ancient"];
/** How tall each stage stands above the soil, and its crown's radius once it's a tree. */
const HEIGHT = { full: [1, 5, 8, 12, 16, 18, 21], mini: [1, 3, 4, 6, 7, 8, 9] };
const CROWN = { full: [0, 0, 0, 4.5, 6, 6.5, 7.5], mini: [0, 0, 0, 2, 2.5, 3, 3.5] };
/** Where fruit, blossoms and golden leaves sit on a crown, from its centre. */
const FRUIT_SPOTS = [
  [-3, -1],
  [1, -3],
  [2, 1],
  [-1, 2],
] as const;
const BLOSSOM_SPOTS = [
  [-2, -2],
  [2, -1],
  [0, 2],
  [-3, 1],
  [3, 2],
] as const;

export type PlantLook = {
  stage: StageKey;
  species?: string;
  dormant?: boolean;
  fruit?: number;
  goldenLeaves?: number;
  /** With its key bed (32 × 32); without, the plant alone, standing on its bottom row. */
  bed?: boolean;
  /** One frame of a sway: the crown leans a pixel. */
  sway?: boolean;
  /** The small plant in a neighbour's bed. */
  mini?: boolean;
};

/** The key bed: an isometric keyboard key, hedge on its sides, soil on its top. */
function drawKey(c: PixelCanvas) {
  c.isoBox(1.5, 1.5, 3, { left: "g", right: "G", top: "u" }, 31, 4);
  c.polygon(
    [
      [MID, 18],
      [25, 22],
      [MID, 26],
      [7, 22],
    ],
    "s",
  );
  for (const [x, y] of [[11, 22], [14, 24], [19, 20], [21, 23], [16, 19]] as const) c.set(x, y, "b");
}

function ellipse(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, ch: string) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) c.set(x, y, ch);
}

function thickLine(c: PixelCanvas, from: [number, number], to: [number, number], ch: string, width = 2) {
  const steps = Math.ceil(Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])));
  for (let i = 0; i <= steps; i++) {
    const x = from[0] + ((to[0] - from[0]) * i) / (steps || 1);
    const y = from[1] + ((to[1] - from[1]) * i) / (steps || 1);
    c.rect(Math.round(x - width / 2), Math.round(y), width, 1, ch);
  }
}

/** The plant itself, its foot at (MID, BASE), in L(eaf) D(eep) T(runk) B(lossom) and the world's colours. */
function drawPlant(c: PixelCanvas, look: Look, opts: Required<Pick<PlantLook, "dormant" | "fruit" | "goldenLeaves" | "mini">> & { stage: StageKey }) {
  const i = STAGE_ORDER.indexOf(opts.stage);
  const size = opts.mini ? "mini" : "full";
  const h = HEIGHT[size][i];
  const r = CROWN[size][i];
  const top = BASE - h;
  const cy = Math.round(top + r);
  const leaves = (spots: readonly (readonly [number, number])[]) =>
    spots.slice(0, opts.mini ? 0 : Math.min(opts.goldenLeaves, 3)).forEach(([x, y]) => c.set(x, y, "Y").set(x + 1, y, "Y").set(x + 1, y + 1, "O"));

  if (opts.stage === "seed") {
    c.rect(MID - 1, BASE, 2, 1, "P").set(MID, BASE - 1, "P");
    leaves([[9, 21], [20, 23], [13, 25]]);
    return;
  }
  if (opts.stage === "sprout") {
    c.rect(MID, top, 1, h, "D");
    c.rect(MID - 3, top, 3, 1, "L").rect(MID + 1, top - 1, 3, 1, "L");
    leaves([[9, 21], [20, 23], [13, 25]]);
    return;
  }
  if (opts.stage === "sapling") {
    c.rect(MID, top + 1, 1, h - 1, "T");
    if (opts.mini) c.rect(MID - 1, top, 3, 2, "L");
    else c.rect(MID - 4, top + 5, 4, 1, "L").rect(MID + 1, top + 3, 4, 1, "L").rect(MID - 1, top, 3, 3, "D");
    leaves([[9, 21], [20, 23], [13, 25]]);
    return;
  }

  const ancient = opts.stage === "ancient";
  const trunkWidth = opts.mini ? 1 : ancient ? 3 : 2;
  const trunkX = MID - Math.floor(trunkWidth / 2);
  switch (look.canopy) {
    case "cone":
      c.rect(trunkX, Math.round(cy + r), trunkWidth, Math.round(BASE - cy - r + 1), "T");
      c.polygon([[MID, top], [MID + r + 1, cy + r + 1], [MID - r - 1, cy + r + 1]], "D");
      c.polygon([[MID, top + 1], [MID, cy + r], [MID - r, cy + r]], "L");
      break;
    case "flower":
      c.rect(MID, cy, 1, BASE - cy + 1, "D");
      if (!opts.mini) c.rect(MID - 3, Math.round(cy + r + 2), 3, 1, "D").rect(MID + 1, Math.round(cy + r + 4), 3, 1, "D");
      c.disc(MID, cy, r * 0.95, "L");
      c.disc(MID, cy, r * 0.45, "b");
      break;
    case "fronds":
      for (const [deg, ch] of [[-55, "D"], [55, "D"], [-28, "L"], [28, "L"], [0, "L"]] as const) {
        const a = (deg * Math.PI) / 180;
        thickLine(c, [MID, BASE], [MID + Math.sin(a) * h, BASE - Math.cos(a) * h], ch, opts.mini ? 1 : 2);
      }
      break;
    case "weeping":
      c.rect(trunkX, cy, trunkWidth, BASE - cy + 1, "T");
      ellipse(c, MID, cy, r + 1, r * 0.75, "D");
      ellipse(c, MID - 1, cy - 1, r * 0.7, r * 0.45, "L");
      for (let k = -r; k <= r; k += Math.max(1, r / 2)) c.rect(Math.round(MID + k), Math.round(cy), 1, Math.round(r + 1 - Math.abs(k) / 2), "L");
      break;
    default:
      c.rect(trunkX, cy, trunkWidth, BASE - cy + 1, "T");
      if (ancient && !opts.mini) c.set(MID - 2, BASE - 5, "T").set(MID - 3, BASE - 6, "T").set(MID + 2, BASE - 7, "T").set(MID + 3, BASE - 8, "T");
      c.disc(MID, cy, r, "D");
      c.disc(MID - 1, cy - 1, r * 0.7, "L");
  }
  if (opts.mini) return;

  if (opts.stage === "blossoming" && !opts.dormant) for (const [dx, dy] of BLOSSOM_SPOTS) c.set(MID + dx, Math.round(cy) + dy, "B");
  if (ancient && !opts.dormant)
    for (let k = 0; k < 24; k += 1) {
      const a = (k / 24) * Math.PI * 2;
      if (k % 2 === 0) c.set(Math.round(MID - 0.5 + Math.cos(a) * (r + 2)), Math.round(cy - 0.5 + Math.sin(a) * (r + 2)), "R");
    }
  for (const [dx, dy] of FRUIT_SPOTS.slice(0, Math.min(opts.fruit, 4))) c.rect(MID + dx, Math.round(cy) + dy, 2, 2, "F");
  const y = Math.round(cy);
  leaves([
    [MID - Math.ceil(r) - 2, y + 1],
    [MID + Math.ceil(r), y - 2],
    [MID - 3, top - 2],
  ]);
}

/** Leans everything above the lowest few rows one pixel to the right. */
function swayed(layer: PixelCanvas) {
  for (let y = 0; y < BASE - 3; y++) {
    const row = layer.cells[y];
    row.pop();
    row.unshift(".");
  }
}

/** The rows from the first painted one down to `bottom`. */
function crop(m: PixelMap, bottom: number): PixelMap {
  const first = Math.max(0, m.rows.findIndex((r) => /[^.]/.test(r)));
  return { ...m, rows: m.rows.slice(first, bottom + 1) };
}

/** A plant for its stage and species, on its key bed (32 × 32) or alone. */
export function plantSprite(opts: PlantLook): PixelMap {
  const look = lookOf(opts.species ?? "helpful_oak");
  const dormant = !!opts.dormant;
  const palette = {
    L: dormant ? AUTUMN.leaf : look.leaf,
    D: dormant ? AUTUMN.deep : look.deep,
    T: look.trunk ?? "#8a5a3b",
    B: look.blossom ?? "#f6efe4",
    F: "#f7a501", // fruit: lantern gold
    R: "#f7a501", // the Ancient ring
    Y: "#f7c325", // a golden leaf
    O: "#b7791f", // its tip
  };
  const layer = new PixelCanvas(PLANT_SIZE, PLANT_SIZE);
  drawPlant(layer, look, { stage: opts.stage, dormant, fruit: opts.fruit ?? 0, goldenLeaves: opts.goldenLeaves ?? 0, mini: !!opts.mini });
  if (opts.sway) swayed(layer);
  if (opts.bed === false) return crop(layer.outline().map(palette), BASE + 1);
  const c = new PixelCanvas(PLANT_SIZE, PLANT_SIZE);
  drawKey(c);
  c.stamp(layer.map(), 0, 0);
  return c.outline().map(palette);
}

/** An empty key bed on the map, with a small "plant" sign stuck in it when you can plant. */
export function keyBedSprite({ sign }: { sign: boolean }): PixelMap {
  const c = new PixelCanvas(PLANT_SIZE, PLANT_SIZE);
  drawKey(c);
  if (sign) c.rect(MID, 15, 1, 7, "b").rect(MID - 3, 12, 7, 4, "p").rect(MID - 2, 13, 2, 1, "g").rect(MID + 1, 14, 2, 1, "g");
  return crop(c.outline().map(), PLANT_SIZE - 1);
}
