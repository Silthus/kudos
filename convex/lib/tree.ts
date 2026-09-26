/**
 * The Ancient Tree of Appreciation: the pure rules of the tree design plan (#152 §S1). A workspace
 * is a desert until its first thoughtful kudos plants the seed at the origin. The tree's **growth**
 * is its **sap** (the seeds of appreciation receivers planted at the tree: one seed per person
 * thanked in a qualifying kudos, sown when the kudos is given, planted by its receiver or by time)
 * plus its **fuel** (from the coins givers claim at the offering stone). Growth sets the **stage**, and the stage opens **districts**:
 * the places of the world, hung on the tree as it grows. Past the world tree the tree grows a
 * **ring** every 10,000 growth, forever, which adds branches and home plots but opens nothing new.
 *
 * A revoke can lower growth, but a tree never shrinks: **the stage is always the stage of the peak
 * growth** the tree has reached (the backend keeps `peakGrowth`; `stageForGrowth(peak)` is the one
 * stage every system uses: districts, raids, crew parts, blights, announcements), and only the
 * meter to the next stage reads current growth. So a district that opened stays open and a plot
 * that was sold stays on the map.
 *
 * Seeds are uint32 (`worldSeed`, drawn as `Math.floor(Math.random() * 2 ** 32)` at install); the
 * layout is computed on the server, since trig isn't bit-identical across browser engines.
 *
 * The layout is seeded by the workspace, so every company's tree stands differently. Each anchor's
 * angle comes only from the seed and the district's own name, and the collision stepping runs in
 * opening order, which is fixed; so adding a district later, or removing one, never moves an
 * earlier-opening one under a player. Only the structures are server state; the terrain around
 * them is drawn from the same seed on the client.
 */
import { whole } from "./numbers";
import { fnv1a, mulberry32 } from "./random";

export type TreeStageId = "seed" | "sprout" | "sapling" | "young" | "grown" | "great" | "ancient" | "elder" | "world_tree";

export type TreeStage = { id: TreeStageId; name: string; growth: number; index: number };

const STAGE_LIST: { id: TreeStageId; name: string; growth: number }[] = [
  { id: "seed", name: "a seed", growth: 0 },
  { id: "sprout", name: "a sprout", growth: 5 },
  { id: "sapling", name: "a sapling", growth: 25 },
  { id: "young", name: "a young tree", growth: 100 },
  { id: "grown", name: "a grown tree", growth: 300 },
  { id: "great", name: "a great tree", growth: 800 },
  { id: "ancient", name: "an ancient tree", growth: 2000 },
  { id: "elder", name: "an elder tree", growth: 3000 },
  { id: "world_tree", name: "the world tree", growth: 8000 },
];

export const TREE_STAGES: TreeStage[] = STAGE_LIST.map((s, index) => ({ ...s, index }));
export const TREE_STAGE_BY_ID = Object.fromEntries(TREE_STAGES.map((s) => [s.id, s])) as Record<TreeStageId, TreeStage>;
/** Past the world tree: one more ring of branches per this much growth, forever. */
export const RING_GROWTH = 10_000;
export const TREE_ORIGIN = { x: 0, y: 0 } as const;

export function isTreeStageId(id: string): id is TreeStageId {
  return Object.hasOwn(TREE_STAGE_BY_ID, id);
}

export function stageIndex(id: TreeStageId): number {
  return TREE_STAGE_BY_ID[id].index;
}

/**
 * Seeds one kudos line (one person thanked) sows: 1 when the line is qualifying (a note of 3+ words
 * and not a thank-back, decided per line by the engine, as XP is), else 0. Never doubled: bonus
 * days double XP and coins, not the company's appreciation. The receiver **plants** their seeds
 * at the tree (or they plant themselves after `SEED_AUTO_PLANT_DAYS`), and a planted seed is one
 * **sap**. Seeds are replayable from the surviving kudos rows; which are planted is state.
 */
export function seedsForLine(line: { qualifying: boolean }): number {
  return line.qualifying ? 1 : 0;
}

/** A seed nobody planted plants itself after this many days, so an absent receiver never stalls the tree. */
export const SEED_AUTO_PLANT_DAYS = 30;

/**
 * Fuel one kudos line adds to its offering when claimed: 1 per qualifying line, whatever the amount
 * or the bonus day (so a claim is a burst, but never worth more than the giving itself). The
 * offering row stores this next to the credited coins; the tree counts `fuel` in halves.
 */
export function fuelForLine(line: { qualifying: boolean }): number {
  return line.qualifying ? 1 : 0;
}
export const GROWTH_PER_FUEL = 0.5;
/** An offering nobody claimed claims itself after this many days, with a DM. */
export const OFFERING_AUTO_CLAIM_DAYS = 30;

/** The tree's growth: `sap` (seeds planted by their receivers or by time) plus half a point per `fuel` claimed. */
export function growthFor(t: { sap: number; fuel: number }): number {
  return Math.max(0, whole(t.sap)) + Math.floor(Math.max(0, whole(t.fuel)) * GROWTH_PER_FUEL);
}

/** The stage `growth` has reached; below zero (after revokes) is still the seed. Pass the **peak** growth. */
export function stageForGrowth(growth: number): TreeStageId {
  const g = whole(growth);
  let stage = TREE_STAGES[0];
  for (const s of TREE_STAGES) if (g >= s.growth) stage = s;
  return stage.id;
}

/** How much more growth the next stage needs; past the world tree, the next ring. */
export function growthToNext(growth: number): { next: TreeStageId | "ring"; growth: number } {
  const g = whole(growth);
  const next = TREE_STAGES[stageIndex(stageForGrowth(g)) + 1];
  if (next) return { next: next.id, growth: next.growth - g };
  const top = TREE_STAGE_BY_ID.world_tree.growth;
  return { next: "ring", growth: RING_GROWTH - ((g - top) % RING_GROWTH) };
}

/** Growth still needed to reach `stage` from `growth` (0 when already there). */
export function growthToReach(growth: number, stage: TreeStageId): number {
  return Math.max(0, TREE_STAGE_BY_ID[stage].growth - whole(growth));
}

export function ringsForGrowth(growth: number): number {
  const g = whole(growth);
  const top = TREE_STAGE_BY_ID.world_tree.growth;
  return g < top ? 0 : Math.floor((g - top) / RING_GROWTH);
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
  opens: TreeStageId;
  /** The places (nav ids) that live in it; systems without a page list none. */
  places: string[];
  /** One line shown at its dry outline before it opens. */
  promise: string;
  /** How far from the trunk it stands (tiles); stepping may add up to 2. Home plots start further out. */
  radius: number;
};

/** In opening order; `districtsOpen` returns a prefix of this list. */
export const DISTRICTS: District[] = [
  { id: "base_camp", name: "Base camp", opens: "seed", places: ["me", "playground"], promise: "", radius: 0 },
  { id: "signpost", name: "The signpost", opens: "sprout", places: ["quests"], promise: "Quests hang here once the tree sprouts.", radius: 7 },
  { id: "notice_board", name: "The notice board", opens: "sprout", places: ["leaderboard"], promise: "The company's standings, pinned up once the tree sprouts.", radius: 7 },
  { id: "terrace", name: "The terraces", opens: "sapling", places: ["garden"], promise: "Your own garden, on the tree's first branch.", radius: 10 },
  { id: "gallery", name: "The gallery", opens: "sapling", places: ["discoveries"], promise: "Every message the bot ever found, framed.", radius: 10 },
  { id: "stall", name: "The stall", opens: "young", places: ["store"], promise: "Trade fruit and Hog coins for things.", radius: 13 },
  { id: "oak", name: "The elder oak", opens: "young", places: ["skills"], promise: "Learn what your level lets you.", radius: 13 },
  { id: "pool", name: "The mirror pool", opens: "young", places: ["compare"], promise: "See yourself against past you and the team.", radius: 13 },
  { id: "homes", name: "The homes", opens: "grown", places: [], promise: "Branch plots to build a home on.", radius: 16 },
  { id: "observatory", name: "The observatory", opens: "grown", places: ["analytics"], promise: "Where recognition flows, seen from above.", radius: 16 },
  { id: "gatehouse", name: "The gatehouse", opens: "grown", places: ["admin"], promise: "Admins keep the tree's rules here.", radius: 16 },
  { id: "near_ruins", name: "The near ruins", opens: "great", places: [], promise: "The first ruins in the sand: expeditions begin.", radius: 19 },
  { id: "crew", name: "The crew's plaque", opens: "great", places: [], promise: "Pool coins to shape the tree together.", radius: 8 },
  { id: "far_ruins", name: "The far ruins", opens: "ancient", places: [], promise: "Deeper ruins, and the blights that come with them.", radius: 19 },
  { id: "blight", name: "The blight stone", opens: "ancient", places: [], promise: "When a blight comes, the company defends the tree here.", radius: 5 },
  { id: "deep_ruins", name: "The deep ruins", opens: "elder", places: [], promise: "The deepest ruins, for the most travelled.", radius: 19 },
  { id: "overview", name: "The overview", opens: "elder", places: [], promise: "The whole tree and its desert, from above.", radius: 21 },
  { id: "canopy", name: "The canopy", opens: "world_tree", places: [], promise: "Every home on the tree, lit at night.", radius: 21 },
];

export const DISTRICT_BY_ID = Object.fromEntries(DISTRICTS.map((d) => [d.id, d])) as Record<DistrictId, District>;

export function districtsOpen(stage: TreeStageId): DistrictId[] {
  const at = stageIndex(stage);
  return DISTRICTS.filter((d) => stageIndex(d.opens) <= at).map((d) => d.id);
}

export function placeDistrict(place: string): DistrictId | null {
  return DISTRICTS.find((d) => d.places.includes(place))?.id ?? null;
}

export type Tile = { x: number; y: number };
export type RuinTier = 1 | 2 | 3;
/** A ruin as it stands in the desert; what's inside it is `lib/rpg.ts`'s `generateRuin`. */
export type RuinSite = { id: string; name: string; tier: RuinTier; at: Tile };
export type Layout = {
  tree: Tile;
  stage: TreeStageId;
  rings: number;
  /** Every district, with whether the tree has opened it; closed ones are drawn as dry outlines. */
  districts: { id: DistrictId; at: Tile; open: boolean }[];
  /** Branch plots for homes, in plot order; empty until the homes district opens. */
  homes: Tile[];
  /** Ruins the tree has opened. */
  ruins: RuinSite[];
};

/** Anchors keep at least this many tiles between them. */
export const MIN_ANCHOR_GAP = 4;
/** No anchor stands further out than this, even after stepping around a neighbour. */
export const MAX_ANCHOR_RADIUS = 24;
/** Home plots spiral outward from here, clear of every anchor; the ruins start well beyond them. */
const HOMES_INNER_RADIUS = 26;
export const HOMES_BASE = 24;
export const HOMES_PER_RING = 12;
/** Each plot adds this much radius, so plots a ring apart never touch. */
const HOMES_SPIRAL_STEP = 0.045;
/** Plots stop here so the spiral never reaches the near ruins; a bigger company builds upward, not outward. */
export const MAX_HOME_PLOTS = 600;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const RUIN_RADIUS: Record<RuinTier, number> = { 1: 60, 2: 110, 3: 180 };
export const RUINS_PER_TIER = 6;

const RUIN_FIRST = ["Sunken", "Hollow", "Whispering", "Buried", "Gilded", "Silent", "Broken", "Amber", "Salt", "Moonlit", "Copper", "Drowned"];
const RUIN_SECOND = ["Archive", "Cistern", "Stair", "Watchtower", "Vault", "Orchard", "Aqueduct", "Kiln", "Library", "Colonnade", "Well", "Observatory"];

const tile = (angle: number, radius: number): Tile => ({ x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius) });
const gap = (a: Tile, b: Tile) => Math.hypot(a.x - b.x, a.y - b.y);
/** A random source that depends only on the seed and one name, so no anchor depends on another's draw. */
const draw = (seed: number, name: string) => mulberry32(fnv1a(`tree:${seed >>> 0}:${name}`));

/** The ruins of a tier are `ruin:<tier>:<index>` with six per tier; the blight raid is `raid:<tier>`. */
export function ruinTier(id: string): RuinTier | null {
  const m = /^(?:ruin:([123]):(\d)|raid:([123]))$/.exec(id);
  if (!m) return null;
  if (m[2] !== undefined && Number(m[2]) >= RUINS_PER_TIER) return null;
  return Number(m[1] ?? m[3]) as RuinTier;
}

export function isRaidId(id: string): boolean {
  return /^raid:[123]$/.test(id);
}

/** The blight raid's tier by the tree's stage: it only comes from the ancient stage on. */
export function raidTier(stage: TreeStageId): RuinTier {
  return stage === "world_tree" ? 3 : stage === "elder" ? 2 : 1;
}

/**
 * Where everything stands for a workspace at its **peak** growth: deterministic in (seed, growth),
 * and stable as the tree grows. The base camp is always at the trunk.
 */
export function layout(seed: number, peakGrowth: number): Layout {
  const stage = stageForGrowth(peakGrowth);
  const rings = ringsForGrowth(peakGrowth);
  const open = new Set(districtsOpen(stage));
  const districts: Layout["districts"] = [{ id: "base_camp", at: { ...TREE_ORIGIN }, open: true }];
  for (const d of DISTRICTS) {
    if (d.id === "base_camp") continue;
    const angle = draw(seed, `district:${d.id}`)() * Math.PI * 2;
    let at = tile(angle, d.radius);
    // Step around the trunk until the anchor keeps its distance from every earlier-opening district.
    for (let bump = 1; districts.some((p) => gap(p.at, at) < MIN_ANCHOR_GAP) && bump < 64; bump++) {
      at = tile(angle + bump * 0.31, Math.min(MAX_ANCHOR_RADIUS, d.radius + (bump % 3)));
    }
    districts.push({ id: d.id, at, open: open.has(d.id) });
  }

  const homes: Tile[] = [];
  const start = draw(seed, "homes")() * Math.PI * 2;
  for (let i = 0; i < homePlots(peakGrowth); i++) homes.push(tile(start + i * GOLDEN_ANGLE, HOMES_INNER_RADIUS + i * HOMES_SPIRAL_STEP));

  const ruins: RuinSite[] = [];
  const tiers: { tier: RuinTier; district: DistrictId }[] = [
    { tier: 1, district: "near_ruins" },
    { tier: 2, district: "far_ruins" },
    { tier: 3, district: "deep_ruins" },
  ];
  for (const { tier, district } of tiers) {
    if (!open.has(district)) continue;
    for (let i = 0; i < RUINS_PER_TIER; i++) {
      const id = `ruin:${tier}:${i}`;
      const rand = draw(seed, id);
      // A ruin's name is its own draw, so no ruin's name depends on another's.
      const name = `The ${RUIN_FIRST[Math.floor(rand() * RUIN_FIRST.length)]} ${RUIN_SECOND[Math.floor(rand() * RUIN_SECOND.length)]}`;
      const angle = (i / RUINS_PER_TIER) * Math.PI * 2 + rand() * (Math.PI / RUINS_PER_TIER);
      ruins.push({ id, name, tier, at: tile(angle, RUIN_RADIUS[tier] + Math.round((rand() - 0.5) * 8)) });
    }
  }

  return { tree: { ...TREE_ORIGIN }, stage, rings, districts, homes, ruins };
}

/** The number of home plots a tree at `peakGrowth` has: none until the homes district opens. */
export function homePlots(peakGrowth: number): number {
  const open = districtsOpen(stageForGrowth(peakGrowth)).includes("homes");
  return open ? Math.min(MAX_HOME_PLOTS, HOMES_BASE + HOMES_PER_RING * ringsForGrowth(peakGrowth)) : 0;
}
