import type { DistrictId, RuinTier, Tile } from "../../convex/lib/tree";
import { fnv1a, mulberry32 } from "../../convex/lib/random";
import { PixelCanvas, type PixelMap } from "./pixels";

/**
 * The overview map (#163, plan #152 S1): the tree and its desert from above, in pixels. The world's
 * tiles are squeezed onto a small square: the districts close round the trunk keep their room (a
 * tile is 1.7 map pixels out to the homes), and the desert beyond is folded in (a tile is 0.3 pixels
 * out to the deep ruins), so the tree's whole reach fits on one map. Every angle is kept: what lies
 * east of the tree lies east on the map.
 */

export const MAP_SIZE = 181;
const CENTRE = (MAP_SIZE - 1) / 2;
/** Out to here (tiles) the map keeps a tile 1.7 pixels wide; past it, 0.3. */
const INNER_TILES = 24;
const INNER_SCALE = 1.7;
const OUTER_SCALE = 0.3;

/** How far out a spot `r` tiles from the trunk is drawn, in map pixels. */
export function mapRadius(r: number): number {
  return r <= INNER_TILES ? r * INNER_SCALE : INNER_TILES * INNER_SCALE + (r - INNER_TILES) * OUTER_SCALE;
}

/** Where a tile of the world is drawn on the map, in map pixels from its top left. */
export function onMap(t: Tile): { x: number; y: number } {
  const r = Math.hypot(t.x, t.y);
  if (r === 0) return { x: CENTRE, y: CENTRE };
  const k = mapRadius(r) / r;
  return { x: Math.round(CENTRE + t.x * k), y: Math.round(CENTRE + t.y * k) };
}

/** The rings drawn round the tree: where the homes stand, and the three rings of ruins (tiles out). */
export const RINGS = [
  { id: "homes", tiles: 26, colour: "B" },
  { id: "near", tiles: 60, colour: "D" },
  { id: "far", tiles: 110, colour: "D" },
  { id: "deep", tiles: 180, colour: "x" },
] as const;

/** The pixels of a dotted ring `tiles` out from the trunk, on the map. */
export function ringPixels(tiles: number): { x: number; y: number }[] {
  const radius = mapRadius(tiles);
  const steps = Math.max(24, Math.round(radius * 2 * Math.PI));
  const seen = new Set<string>();
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < steps; i += 2) {
    const a = (i / steps) * Math.PI * 2;
    const at = { x: Math.round(CENTRE + Math.cos(a) * radius), y: Math.round(CENTRE + Math.sin(a) * radius) };
    const key = `${at.x},${at.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(at);
  }
  return out;
}

/** The tree from above: its shade, its crown, the sap glowing in it; bigger with its stage (`stageIndex` 0 for the seed to 8 for the world tree). */
export function treeFromAbove(stageIndex: number): PixelMap {
  const crown = 3 + Math.round(stageIndex * 0.9);
  const size = crown * 2 + 4;
  const mid = crown + 1;
  const c = new PixelCanvas(size, size);
  const rand = mulberry32(fnv1a(`crown:${stageIndex}`));
  c.disc(mid + 1, mid + 2, crown, "n");
  c.disc(mid, mid, crown, "G");
  c.disc(mid - 1, mid - 1, Math.max(1, crown - 2), "g");
  for (let i = 0; i < stageIndex + 2; i++) c.set(mid - crown + 2 + Math.floor(rand() * (crown * 2 - 3)), mid - crown + 2 + Math.floor(rand() * (crown * 2 - 3)), "y");
  return c.map();
}

/** The map's ground: sand with its dunes and oases, framed in bark. */
export function overviewGround(seed: number): PixelMap {
  const c = new PixelCanvas(MAP_SIZE, MAP_SIZE);
  c.rect(0, 0, MAP_SIZE, MAP_SIZE, "a");
  // Dune shadows scattered by the world's own seed: every company's desert reads a little differently.
  const rand = mulberry32(fnv1a(`overview:${seed >>> 0}`));
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(rand() * MAP_SIZE);
    const y = Math.floor(rand() * MAP_SIZE);
    c.rect(x, y, 2 + Math.floor(rand() * 4), 1, rand() < 0.7 ? "A" : "D");
  }
  // Oases.
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2;
    const r = 60 + rand() * 25;
    c.disc(Math.round(CENTRE + Math.cos(a) * r), Math.round(CENTRE + Math.sin(a) * r), 2, "w");
  }
  // A frame of bark round the whole map.
  c.rect(0, 0, MAP_SIZE, 1, "b").rect(0, MAP_SIZE - 1, MAP_SIZE, 1, "b").rect(0, 0, 1, MAP_SIZE, "b").rect(MAP_SIZE - 1, 0, 1, MAP_SIZE, "b");
  return c.map();
}

/** A district's icon on the map (7 × 7, our own pixels). */
type Glyph = "sign" | "leaf" | "frame" | "stall" | "pool" | "house" | "ruin" | "stone" | "eye";
const GLYPHS: Record<Glyph, string[]> = {
  sign: ["...b...", ".ppppp.", ".pPPPp.", ".ppppp.", "...b...", "...b...", "..bbb.."],
  leaf: ["..ggg..", ".gGgGg.", "gGgygGg", ".gGgGg.", "..gBg..", "...B...", "..BBB.."],
  frame: ["bbbbbbb", "bpppppb", "bplllpb", "bplelpb", "bplllpb", "bpppppb", "bbbbbbb"],
  stall: ["eceecee", "eceecee", ".b...b.", ".b...b.", ".bPPPb.", ".bPlPb.", ".bbbbb."],
  pool: [".mmmmm.", "mwwwwwm", "mwWwwwm", "mwwwcwm", "mwwwwwm", ".mmmmm.", "......."],
  house: ["...b...", "..bBb..", ".bBBBb.", "bpppppb", ".pllPp.", ".pllPp.", ".bbbbb."],
  ruin: [".mmmmm.", "mMmmmMm", "mk...km", "mk...km", "mk...km", "AAAAAAA", "......."],
  stone: ["..mmm..", ".mmmmm.", ".mxmmm.", "mmmmxmm", "mmxmmmm", ".mmmmm.", "AAAAAAA"],
  eye: ["..bbb..", ".bPPPb.", "bPlllPb", "bPlilPb", "bPlllPb", ".bPPPb.", "..bbb.."],
};

const DISTRICT_GLYPH: Record<DistrictId, Glyph | null> = {
  base_camp: null, // the tree itself
  signpost: "sign",
  notice_board: "sign",
  terrace: "leaf",
  gallery: "frame",
  stall: "stall",
  oak: "leaf",
  pool: "pool",
  homes: "house",
  observatory: "eye",
  gatehouse: "house",
  near_ruins: "ruin",
  crew: "sign",
  far_ruins: "ruin",
  blight: "stone",
  deep_ruins: "ruin",
  overview: "frame",
  canopy: "leaf",
};

/** The icon a district is drawn with on the map; null for base camp, which is the tree. */
export function districtGlyph(id: string): PixelMap | null {
  const g = DISTRICT_GLYPH[id as DistrictId];
  return g ? { rows: GLYPHS[g] } : null;
}

/** A ruin's marker (5 × 5): lit once you've cleared it, dark sand until then; each tier its own shape. */
export function ruinMarker(tier: RuinTier, explored: boolean): PixelMap {
  const fill = explored ? "l" : "n";
  const core = explored ? "e" : "D";
  const rows: Record<RuinTier, string[]> = {
    1: [".kkk.", `k${fill}${fill}${fill}k`, `k${fill}${core}${fill}k`, `k${fill}.${fill}k`, "kk.kk"],
    2: [".kkk.", `.k${fill}k.`, `k${fill}${core}${fill}k`, `k${fill}${fill}${fill}k`, "kkkkk"],
    3: ["kkkkk", `k${fill}${fill}${fill}k`, `.k${core}k.`, `..k..`, "....."],
  };
  return { rows: rows[tier] };
}
