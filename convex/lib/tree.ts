/**
 * The Ancient Tree of Appreciation: the pure rules of the tree design plan (#152 §S1). A workspace
 * is a desert until its first thoughtful kudos plants the seed at the origin. Every qualifying kudos
 * after that is **sap**; sap sets the tree's **stage**, and the stage opens **districts**: the places
 * of the world, hung on the tree as it grows. Past the world tree the tree grows a **ring** every
 * 10,000 sap, forever, which adds branches and height but opens nothing new.
 *
 * The layout is seeded by the workspace, so every company's tree stands differently, and a
 * district keeps its anchor once placed: nothing ever moves under a player. Only the structures
 * are server state; the terrain around them is drawn from the same seed on the client.
 */
import { fnv1a, mulberry32 } from "./random";

export type StageId = "seed" | "sprout" | "sapling" | "young" | "grown" | "great" | "ancient" | "elder" | "world_tree";

export type Stage = { id: StageId; name: string; sap: number; index: number };

const STAGE_LIST: { id: StageId; name: string; sap: number }[] = [
  { id: "seed", name: "a seed", sap: 0 },
  { id: "sprout", name: "a sprout", sap: 5 },
  { id: "sapling", name: "a sapling", sap: 25 },
  { id: "young", name: "a young tree", sap: 100 },
  { id: "grown", name: "a grown tree", sap: 300 },
  { id: "great", name: "a great tree", sap: 800 },
  { id: "ancient", name: "an ancient tree", sap: 2000 },
  { id: "elder", name: "an elder tree", sap: 5000 },
  { id: "world_tree", name: "the world tree", sap: 12_000 },
];

export const STAGES: Stage[] = STAGE_LIST.map((s, index) => ({ ...s, index }));
export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<StageId, Stage>;
/** Past the world tree: one more ring of branches per this much sap, forever. */
export const RING_SAP = 10_000;
export const TREE_ORIGIN = { x: 0, y: 0 } as const;

export function stageIndex(id: StageId): number {
  return STAGE_BY_ID[id].index;
}

/** The stage `sap` has reached; revokes can push sap below zero, which is still the seed. */
export function stageForSap(sap: number): StageId {
  let stage = STAGES[0];
  for (const s of STAGES) if (sap >= s.sap) stage = s;
  return stage.id;
}

/** How much more sap the next stage needs, or null at the world tree (then only rings grow). */
export function sapToNext(sap: number): { next: StageId; sap: number } | null {
  const current = stageIndex(stageForSap(sap));
  const next = STAGES[current + 1];
  return next ? { next: next.id, sap: next.sap - sap } : null;
}

export function ringsForSap(sap: number): number {
  const top = STAGE_BY_ID.world_tree.sap;
  return sap < top ? 0 : Math.floor((sap - top) / RING_SAP);
}

/**
 * Sap a kudos gives the tree: one per person thanked thoughtfully. Never for a thin kudos or a
 * thank-back, and never doubled: bonus days double XP and coins, not the company's appreciation.
 */
export function sapForKudos(k: { qualifying: boolean; recipients: number; bonusDay?: boolean }): number {
  return k.qualifying ? Math.max(0, k.recipients) : 0;
}

export type DistrictId =
  | "base_camp"
  | "signpost"
  | "notice_board"
  | "terrace"
  | "gallery"
  | "stall"
  | "oak"
  | "pool"
  | "homes"
  | "observatory"
  | "gatehouse"
  | "near_ruins"
  | "crew"
  | "far_ruins"
  | "blight"
  | "deep_ruins"
  | "overview"
  | "canopy";

export type District = {
  id: DistrictId;
  name: string;
  /** The stage that opens it. */
  opens: StageId;
  /** The places (nav ids) that live in it; systems without a page list none. */
  places: string[];
  /** One line shown at its dry outline before it opens. */
  promise: string;
};

/** In opening order; `districtsOpen` returns a prefix of this list. */
export const DISTRICTS: District[] = [
  { id: "base_camp", name: "Base camp", opens: "seed", places: ["me", "playground"], promise: "" },
  { id: "signpost", name: "The signpost", opens: "sprout", places: ["quests"], promise: "Quests hang here once the tree sprouts." },
  { id: "notice_board", name: "The notice board", opens: "sprout", places: ["leaderboard"], promise: "The company's standings, pinned up once the tree sprouts." },
  { id: "terrace", name: "The terraces", opens: "sapling", places: ["garden"], promise: "Your own garden, on the tree's first branch." },
  { id: "gallery", name: "The gallery", opens: "sapling", places: ["discoveries"], promise: "Every message the bot ever found, framed." },
  { id: "stall", name: "The stall", opens: "young", places: ["store"], promise: "Trade fruit and Hog coins for things." },
  { id: "oak", name: "The elder oak", opens: "young", places: ["skills"], promise: "Learn what your level lets you." },
  { id: "pool", name: "The mirror pool", opens: "young", places: ["compare"], promise: "See yourself against past you and the team." },
  { id: "homes", name: "The homes", opens: "grown", places: [], promise: "Branch plots to build a home on." },
  { id: "observatory", name: "The observatory", opens: "grown", places: ["analytics"], promise: "Where recognition flows, seen from above." },
  { id: "gatehouse", name: "The gatehouse", opens: "grown", places: ["admin"], promise: "Admins keep the tree's rules here." },
  { id: "near_ruins", name: "The near ruins", opens: "great", places: [], promise: "The first ruins in the sand: expeditions begin." },
  { id: "crew", name: "The crew's plaque", opens: "great", places: [], promise: "Pool coins to shape the tree together." },
  { id: "far_ruins", name: "The far ruins", opens: "ancient", places: [], promise: "Deeper ruins, and the blights that come with them." },
  { id: "blight", name: "The blight stone", opens: "ancient", places: [], promise: "When a blight comes, the company defends the tree here." },
  { id: "deep_ruins", name: "The deep ruins", opens: "elder", places: [], promise: "The deepest ruins, for the most travelled." },
  { id: "overview", name: "The overview", opens: "elder", places: [], promise: "The whole tree and its desert, from above." },
  { id: "canopy", name: "The canopy", opens: "world_tree", places: [], promise: "Every home on the tree, lit at night." },
];

export function districtsOpen(stage: StageId): DistrictId[] {
  const at = stageIndex(stage);
  return DISTRICTS.filter((d) => stageIndex(d.opens) <= at).map((d) => d.id);
}

export function placeDistrict(place: string): DistrictId | null {
  return DISTRICTS.find((d) => d.places.includes(place))?.id ?? null;
}

export type Tile = { x: number; y: number };
export type Ruin = { id: string; name: string; tier: 1 | 2 | 3; at: Tile };
export type Layout = {
  tree: Tile;
  districts: { id: DistrictId; at: Tile }[];
  /** Branch plots for homes, in plot order; empty until the homes district opens. */
  homes: Tile[];
  ruins: Ruin[];
};

/** How far from the trunk each district stands; ruins go far out into the desert. */
const DISTRICT_RADIUS: Record<DistrictId, number> = {
  base_camp: 0,
  signpost: 7,
  notice_board: 7,
  terrace: 10,
  gallery: 10,
  stall: 13,
  oak: 13,
  pool: 13,
  homes: 17,
  observatory: 16,
  gatehouse: 16,
  near_ruins: 22,
  crew: 8,
  far_ruins: 26,
  blight: 6,
  deep_ruins: 30,
  overview: 19,
  canopy: 21,
};
const RUIN_RADIUS: Record<1 | 2 | 3, number> = { 1: 40, 2: 90, 3: 160 };
const HOME_RING_RADIUS = 17;
const HOMES_BASE = 24;
const HOMES_PER_RING = 12;

const RUIN_FIRST = ["Sunken", "Hollow", "Whispering", "Buried", "Gilded", "Silent", "Broken", "Amber", "Salt", "Moonlit", "Copper", "Drowned"];
const RUIN_SECOND = ["Archive", "Cistern", "Stair", "Watchtower", "Vault", "Orchard", "Aqueduct", "Kiln", "Library", "Colonnade", "Well", "Observatory"];

const tile = (angle: number, radius: number): Tile => ({ x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius) });

/**
 * Where everything stands for a workspace, at a stage: deterministic in (seed, stage, rings), and
 * stable as the tree grows (each district's angle is drawn from the seed once, in district order).
 * The base camp is always at the trunk.
 */
export function layout(seed: number, stage: StageId, rings = 0): Layout {
  const rand = mulberry32(fnv1a(`tree:${seed >>> 0}`));
  const open = new Set(districtsOpen(stage));
  const districts: { id: DistrictId; at: Tile }[] = [];
  const taken = new Set<string>(["0,0"]);
  // Spread districts around the trunk: a seeded starting angle, then evenly spaced with jitter,
  // so no two crowd one side of the tree. Angles are drawn for every district, open or not, so
  // opening a later one never changes an earlier one's place.
  const start = rand() * Math.PI * 2;
  DISTRICTS.forEach((d, i) => {
    const angle = start + (i / DISTRICTS.length) * Math.PI * 2 + (rand() - 0.5) * 0.35;
    const radius = DISTRICT_RADIUS[d.id];
    let at = d.id === "base_camp" ? { ...TREE_ORIGIN } : tile(angle, radius);
    // The trunk's neighbours must not land on it or each other.
    let bump = 0;
    while (d.id !== "base_camp" && taken.has(`${at.x},${at.y}`)) at = tile(angle + 0.2 * ++bump, radius + bump);
    taken.add(`${at.x},${at.y}`);
    if (open.has(d.id)) districts.push({ id: d.id, at });
  });

  const homes: Tile[] = [];
  if (open.has("homes")) {
    const count = HOMES_BASE + HOMES_PER_RING * Math.max(0, rings);
    const homeStart = rand() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      // Later rings sit two tiles further out each, so plots never collide as the tree grows.
      const ring = i < HOMES_BASE ? 0 : 1 + Math.floor((i - HOMES_BASE) / HOMES_PER_RING);
      const perRing = i < HOMES_BASE ? HOMES_BASE : HOMES_PER_RING;
      const index = i < HOMES_BASE ? i : (i - HOMES_BASE) % HOMES_PER_RING;
      const angle = homeStart + (index / perRing) * Math.PI * 2 + ring * 0.13;
      homes.push(tile(angle, HOME_RING_RADIUS + ring * 2));
    }
  }

  const ruins: Ruin[] = [];
  const ruinTiers: { tier: 1 | 2 | 3; district: DistrictId }[] = [
    { tier: 1, district: "near_ruins" },
    { tier: 2, district: "far_ruins" },
    { tier: 3, district: "deep_ruins" },
  ];
  const usedNames = new Set<string>();
  for (const { tier, district } of ruinTiers) {
    const ringStart = rand() * Math.PI * 2;
    for (let i = 0; i < 6; i++) {
      // Names are drawn for every ruin, open or not, to keep them stable across stages.
      let name = "";
      do name = `The ${RUIN_FIRST[Math.floor(rand() * RUIN_FIRST.length)]} ${RUIN_SECOND[Math.floor(rand() * RUIN_SECOND.length)]}`;
      while (usedNames.has(name));
      usedNames.add(name);
      const angle = ringStart + (i / 6) * Math.PI * 2 + (rand() - 0.5) * 0.3;
      const at = tile(angle, RUIN_RADIUS[tier] + Math.round((rand() - 0.5) * 6));
      if (open.has(district)) ruins.push({ id: `ruin:${tier}:${i}`, name, tier, at });
    }
  }

  return { tree: { ...TREE_ORIGIN }, districts, homes, ruins };
}
