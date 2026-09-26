import { DISTRICTS, stageIndex, type DistrictId, type Layout, type RuinSite, type TreeStageId } from "../../convex/lib/tree";
import { TOWN_RADIUS, desertAt, desertWalkable, noise, type DesertGround } from "./desert";
import { findPath, type Grid, type Tile } from "./iso";
import { PLACES, placeAt, type PlaceDef } from "./places";
import { BEDS, PLOTS } from "./places/garden";

/**
 * The world on the tree (#152 §S1, #156): the endless desert (`desert.ts`) with the Ancient Tree at
 * the origin and the districts the tree has opened round it. The server says where every district
 * stands (`api.tree.state().layout`, from `convex/lib/tree.ts`); this module turns that into tiles:
 *
 * - **Base camp** at the tree's foot: the offering stone, two tents, the elder hog, your cabin and
 *   the sandbox, and the tile where you arrive.
 * - Each district **settles** at its anchor: its place file's footprint moved there, or the nearest
 *   free spot a step or two away where a neighbour or the trunk is in the way. Settling runs in the
 *   districts' opening order against the trunk at its biggest, so a place never moves as the tree
 *   grows. Open districts stand on a patch of the tree's lawn; closed ones are dry outlines in the
 *   sand you can walk up to, saying how much more the tree needs.
 * - **Paths** from base camp to every open door (and to each ruin entrance, out across the sand),
 *   found once per world with the same walker the hedgehog uses, so every open door is reachable.
 * - The tree's **lawn** greens the desert round its foot, wider at every stage.
 *
 * `buildWorld` is pure and viewer-specific only in which places stand (`standing`: the pages this
 * viewer has); everything else is the same for everyone in the workspace.
 */

export type Terrain = DesertGround | "lawn" | "path" | "garden" | "fence" | "gate" | "plot" | "bed";
/** Tiles from (x0, y0) to (x1, y1), both included. */
export type Rect = { x0: number; y0: number; x1: number; y1: number };
export type PropKind = "stone" | "tent" | "elder";
/** Something standing in base camp that isn't a place (yet): #157 makes the stone an offering stone. */
export type Prop = { kind: PropKind; tile: Tile };
export type OutlineKind = "closed" | "ruin" | "home";
/** Small things on the tree's lawn: lantern posts along the paths (in the way), flowers (not). */
export type Decor = { kind: "lantern" | "flowers"; tile: Tile };

export type Site = {
  id: DistrictId;
  name: string;
  opens: TreeStageId;
  promise: string;
  open: boolean;
  /** Where it settled: its anchor, or a step or two off it. */
  at: Tile;
  /** Its places, settled (whether or not they stand on this viewer's map). */
  places: PlaceDef[];
  /** The tiles it keeps for itself, one rect a place (a marker's plot for a district without one). */
  claims: Rect[];
  /** All of them in one box. */
  claim: Rect;
  /** Its dry outline while it's closed: its places' footprints, or a marker's plot. */
  outline: Rect;
  /** Where you stand to read it: its first door, or beside its marker. */
  approach: Tile;
};

export type WorldInput = {
  seed: number;
  /** The server's layout at the tree's peak growth (stage, rings, districts, homes, ruins). */
  layout: Layout;
  /** Has anyone planted the seed yet? Before that there's no tree, only base camp in the sand. */
  planted: boolean;
  /** The places whose pages this viewer has: only these stand, where their district is open. */
  standing: string[];
};

export type World = Grid & {
  seed: number;
  stage: TreeStageId;
  planted: boolean;
  terrainAt: (x: number, y: number) => Terrain;
  outlineAt: (x: number, y: number) => OutlineKind | null;
  /** Where a new arrival stands: base camp, by the offering stone. */
  spawn: Tile;
  /** The tiles the trunk stands on; null before the seed is planted. */
  trunk: Rect | null;
  props: Prop[];
  sites: Site[];
  /** The places standing on this viewer's map, settled. */
  places: PlaceDef[];
  /** Your key beds on the terrace in planting order, and the neighbours' beds round it; empty while it isn't yours. */
  plots: Tile[];
  beds: Tile[];
  ruins: RuinSite[];
  /** The home plots, numbered as the layout numbers them; a gap where a district stands on the plot. */
  homes: (Tile | null)[];
  decor: Decor[];
  /** Pools of warm light on the ground (tile centres and radii): under the tree, round each lantern and each open place. */
  lights: { x: number; y: number; r: number }[];
  /** How far the tree's lawn reaches from the trunk. */
  lawnRadius: number;
  /** Rings past the world tree. */
  rings: number;
};

/** Walks keep within this many tiles of the tree: far past the deepest ruins, never an edge you meet. */
export const WORLD_EDGE = 400;

/** Base camp, in tiles from the trunk: the stone in front of it, the tents, the elder hog, your cabin and the sandbox. */
export const BASE_CAMP = {
  spawn: { x: 4, y: 4 },
  props: [
    { kind: "stone", tile: { x: 3, y: 3 } },
    { kind: "tent", tile: { x: 6, y: 0 } },
    { kind: "tent", tile: { x: 0, y: 6 } },
    { kind: "elder", tile: { x: 6, y: 2 } },
  ] satisfies Prop[] as Prop[],
  places: { me: { x: 8, y: -1 }, playground: { x: -1, y: 8 } } as Record<string, Tile>,
};

/** How far the trunk reaches from the origin at each stage (a square of 2r + 1 tiles). */
export function trunkRadius(stage: TreeStageId) {
  const i = stageIndex(stage);
  return i < stageIndex("young") ? 0 : i < stageIndex("great") ? 1 : 2;
}
const TRUNK_MAX = 2;
/** Tiles of sand kept between one district and the next, so their doors and signs stay clear. */
const GAP = 3;

const LAWN_BY_STAGE = [1.5, 2.5, 3.8, 5.2, 6.6, 8, 9.5, 11, 13];
export function lawnRadiusFor(stage: TreeStageId, rings: number) {
  return LAWN_BY_STAGE[stageIndex(stage)] + Math.min(6, rings * 0.5);
}

const rectOf = (tiles: Tile[]): Rect => ({
  x0: Math.min(...tiles.map((t) => t.x)),
  y0: Math.min(...tiles.map((t) => t.y)),
  x1: Math.max(...tiles.map((t) => t.x)),
  y1: Math.max(...tiles.map((t) => t.y)),
});
const grow = (r: Rect, n: number): Rect => ({ x0: r.x0 - n, y0: r.y0 - n, x1: r.x1 + n, y1: r.y1 + n });
const meets = (a: Rect, b: Rect) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
export const inRect = (r: Rect, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
const footprintTiles = (p: PlaceDef): Tile[] => [
  { x: p.footprint.x, y: p.footprint.y },
  { x: p.footprint.x + p.footprint.w - 1, y: p.footprint.y + p.footprint.h - 1 },
];
const move = (t: Tile, by: Tile) => ({ x: t.x + by.x, y: t.y + by.y });

/** Offsets to try round an anchor, nearest first, in a fixed order. */
const OFFSETS: Tile[] = (() => {
  const out: Tile[] = [];
  for (let y = -24; y <= 24; y++) for (let x = -24; x <= 24; x++) if (x * x + y * y <= 576) out.push({ x, y });
  return out.sort((a, b) => a.x * a.x + a.y * a.y - (b.x * b.x + b.y * b.y) || a.y - b.y || a.x - b.x);
})();

/** A district's places, settled at `at`, and the tiles they keep (the terrace keeps its neighbours' ring too). */
function districtAt(id: DistrictId, at: Tile) {
  const defs = DISTRICTS.find((d) => d.id === id)!.places.flatMap((pid) => PLACES.filter((p) => p.id === pid));
  const places = defs.map((d) => placeAt(d, at));
  const claims = places.length
    ? places.map((p) => rectOf([...footprintTiles(p), ...p.doors, ...(p.id === "garden" ? BEDS.map((b) => move(b, at)) : [])]))
    : [{ x0: at.x, y0: at.y, x1: at.x + 1, y1: at.y }];
  return { places, claims };
}

type Settled = Omit<Site, "open" | "approach" | "outline">;

/**
 * Where every district stands: base camp round the trunk, then each other district at its anchor,
 * or the nearest spot from it that keeps a tile of sand between it and everything settled before.
 * Pure in the layout's anchors, so it's the same at every stage and for every viewer.
 */
export function settle(layout: Layout): Settled[] {
  const out: Settled[] = [];
  const taken: Rect[] = [];
  const trunk: Rect = { x0: -TRUNK_MAX, y0: -TRUNK_MAX, x1: TRUNK_MAX, y1: TRUNK_MAX };
  const shaded = (r: Rect) => {
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (underCanopy(x, y)) return true;
    return false;
  };
  const base = DISTRICTS[0];
  const basePlaces = base.places.flatMap((pid) => PLACES.filter((p) => p.id === pid).map((p) => placeAt(p, BASE_CAMP.places[pid])));
  const baseClaims = [trunk, ...BASE_CAMP.props.map((p) => rectOf([p.tile])), rectOf([BASE_CAMP.spawn]), ...basePlaces.map((p) => rectOf([...footprintTiles(p), ...p.doors]))];
  taken.push(...baseClaims);
  out.push({ id: base.id, name: base.name, opens: base.opens, promise: base.promise, at: { x: 0, y: 0 }, places: basePlaces, claims: baseClaims, claim: rectOf(baseClaims.flatMap((r) => [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y1 }])) });
  for (const d of DISTRICTS.slice(1)) {
    const anchor = layout.districts.find((a) => a.id === d.id)?.at;
    if (!anchor) continue;
    let chosen = districtAt(d.id, anchor);
    let at = anchor;
    for (const off of OFFSETS) {
      const tryAt = move(anchor, off);
      const next = districtAt(d.id, tryAt);
      if (next.claims.every((c) => !shaded(c) && taken.every((t) => !meets(c, grow(t, GAP))))) {
        chosen = next;
        at = tryAt;
        break;
      }
    }
    taken.push(...chosen.claims);
    out.push({
      id: d.id,
      name: d.name,
      opens: d.opens,
      promise: d.promise,
      at,
      places: chosen.places,
      claims: chosen.claims,
      claim: rectOf(chosen.claims.flatMap((r) => [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y1 }])),
    });
  }
  return out;
}

/**
 * The tiles the canopy stands over on screen, at its biggest (the world tree with its rings): up and
 * behind the trunk, and beside it as far forward as the trunk's front, where the lowest tier droops. No district settles there, so the tree never hides a place, and a place never
 * moves as the canopy grows.
 */
export function underCanopy(x: number, y: number) {
  // Down to the trunk's front corner: a tall building beside the trunk would stand behind the low tier's droop.
  return Math.abs(x - y) <= CANOPY.half && x + y <= CANOPY.front && x + y >= -CANOPY.back;
}
/** The canopy's reach at its biggest, in tiles: sideways (|x − y|) and back up the screen (−(x + y)). `world.test.ts` holds the sprite to it. */
export const CANOPY = { half: 21, back: 64, front: 4 };

const tileKey = (x: number, y: number) => (x + 65536) * 131072 + (y + 65536);

export function buildWorld({ seed, layout, planted, standing }: WorldInput): World {
  const stage = layout.stage;
  const open = new Map(layout.districts.map((d) => [d.id, d.open]));
  const sites: Site[] = settle(layout).map((s) => {
    const isOpen = s.id === "base_camp" || !!open.get(s.id);
    const outline = s.places.length ? rectOf(s.places.flatMap(footprintTiles)) : s.claims[0];
    return {
      ...s,
      open: isOpen,
      outline,
      approach: s.places[0]?.doors[0] ?? { x: s.at.x + 2, y: s.at.y },
    };
  });
  const places = sites.filter((s) => s.open).flatMap((s) => s.places.filter((p) => standing.includes(p.id)));
  const terrace = places.find((p) => p.id === "garden");
  const terraceAt = sites.find((s) => s.id === "terrace")!.at;

  const overlay = new Map<number, Terrain>();
  const blocked = new Set<number>();
  const outlines = new Map<number, OutlineKind>();
  const patches: Rect[] = [];

  const trunkR = planted ? trunkRadius(stage) : -1;
  const trunk: Rect | null = planted ? { x0: -trunkR, y0: -trunkR, x1: trunkR, y1: trunkR } : null;
  if (trunk) for (let y = trunk.y0; y <= trunk.y1; y++) for (let x = trunk.x0; x <= trunk.x1; x++) blocked.add(tileKey(x, y));
  for (const p of BASE_CAMP.props) {
    blocked.add(tileKey(p.tile.x, p.tile.y));
    patches.push(grow(rectOf([p.tile]), 1));
  }

  for (const p of places) {
    const { x, y, w, h } = p.footprint;
    patches.push(grow(rectOf([...footprintTiles(p), ...p.doors]), 1));
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) {
        const own = p.ground?.(i, j);
        if (own) overlay.set(tileKey(i, j), own);
        else if (p.terrain === "water") overlay.set(tileKey(i, j), "water");
        if (!p.walkable && p.terrain !== "water") blocked.add(tileKey(i, j));
      }
  }
  const plots = terrace ? PLOTS.map((t) => move(t, terraceAt)) : [];
  const beds = terrace ? BEDS.map((t) => move(t, terraceAt)) : [];
  for (const b of beds) overlay.set(tileKey(b.x, b.y), "bed");
  if (terrace) patches.push(grow(rectOf(beds), 1));

  // Place-less districts that are open stand as a marker (the later lanes build them); closed ones are outlines.
  for (const s of sites) {
    if (s.id === "base_camp") continue;
    // A lone marker stands on the sand: no patch of lawn under it.
    if (s.open && !s.places.length) blocked.add(tileKey(s.at.x, s.at.y));
    // A closed district is a level pad of dry sand with its footprint dashed round it: something will stand here.
    if (!s.open)
      for (let y = s.outline.y0; y <= s.outline.y1; y++)
        for (let x = s.outline.x0; x <= s.outline.x1; x++) {
          outlines.set(tileKey(x, y), "closed");
          if (!overlay.has(tileKey(x, y))) overlay.set(tileKey(x, y), "sand");
        }
  }

  const rings = layout.rings;
  const lawnRadius = planted ? lawnRadiusFor(stage, rings) : 0;
  // The tree's lawn, and a patch under each place, frayed at its edge: a ring of tiles round each
  // patch is grass or sand by the seed, and corners mostly sand.
  const lawnAt = (x: number, y: number) =>
    (planted && Math.hypot(x, y) + (noise(seed, x, y, 51) - 0.5) * 1.6 <= lawnRadius) ||
    patches.some((r) => (inRect(r, x, y) ? noise(seed, x, y, 52) > (isCorner(r, x, y) ? 0.6 : 0.08) : inRect(grow(r, 1), x, y) && noise(seed, x, y, 54) > 0.62));
  // The ground under the overlay, worked out once a tile: walks and painting ask for it again and again.
  const ground = new Map<number, Terrain>();
  const groundAt = (x: number, y: number): Terrain => {
    const k = tileKey(x, y);
    let t = ground.get(k);
    if (t === undefined) {
      t = lawnAt(x, y) ? "lawn" : desertAt(seed, x, y);
      if (ground.size > 200_000) ground.clear();
      ground.set(k, t);
    }
    return t;
  };
  const baseTerrain = (x: number, y: number): Terrain => (overlay.size && overlay.get(tileKey(x, y))) || groundAt(x, y);

  // Paths: from base camp to every open door, then out to each ruin entrance, merging where they meet.
  const spawn = BASE_CAMP.spawn;
  const town: Grid = {
    bounds: { x0: -TOWN_RADIUS - 4, y0: -TOWN_RADIUS - 4, x1: TOWN_RADIUS + 4, y1: TOWN_RADIUS + 4 },
    walkable: (x, y) => {
      if (blocked.has(tileKey(x, y))) return false;
      const t = baseTerrain(x, y);
      return t !== "fence" && t !== "bed" && t !== "water";
    },
    // Paths prefer each other, avoid outlines, and wander a little by the seed, so none is a ruled line.
    cost: (x, y) => {
      const t = overlay.get(tileKey(x, y));
      if (t === "path" || t === "gate") return 1;
      return outlines.has(tileKey(x, y)) ? 6 : 3 + Math.floor(valueNoise2(seed, x, y) * 4);
    },
  };
  const lay = (walk: Tile[] | null) => {
    for (const t of walk ?? []) if (!overlay.has(tileKey(t.x, t.y))) overlay.set(tileKey(t.x, t.y), "path");
  };
  for (const s of sites) {
    if (!s.open) continue;
    const goals = s.places.length ? places.filter((p) => s.places.some((q) => q.id === p.id)).map((p) => p.doors[0]) : s.id === "base_camp" ? [] : [s.approach];
    for (const g of goals) lay(findPath(town, spawn, g));
  }
  const ruins = layout.ruins;
  for (const r of ruins) {
    for (let y = r.at.y - 1; y <= r.at.y + 1; y++) for (let x = r.at.x - 1; x <= r.at.x + 1; x++) outlines.set(tileKey(x, y), "ruin");
    // Out across the sand, a staircase from the entrance back towards the tree, over rock and water alike.
    const walk: Tile[] = [];
    let t = { ...r.at };
    while (Math.hypot(t.x, t.y) > TOWN_RADIUS - 2) {
      walk.push(t);
      const ax = Math.abs(t.x);
      const ay = Math.abs(t.y);
      t = ax >= ay ? { x: t.x - Math.sign(t.x), y: t.y } : { x: t.x, y: t.y - Math.sign(t.y) };
    }
    lay(walk);
    lay(findPath(town, spawn, t));
  }
  // Home plots keep the layout's numbers (#160 builds on plot i); one a district stands on is a gap.
  const homes = layout.homes.map((h) => (sites.some((s) => s.claims.some((c) => inRect(c, h.x, h.y))) ? null : h));
  for (const h of homes) {
    if (!h) continue;
    // A plot is flat sand, even out where the desert has rock or water.
    if (!overlay.has(tileKey(h.x, h.y))) overlay.set(tileKey(h.x, h.y), "sand");
    if (!outlines.has(tileKey(h.x, h.y))) outlines.set(tileKey(h.x, h.y), "home");
  }

  // Lantern posts along the paths on the tree's lawn, flowers here and there; never on a district's tiles or by a door.
  const decor: Decor[] = [];
  const doors = new Set([...places.flatMap((p) => p.doors), spawn, ...BASE_CAMP.props.map((p) => p.tile)].map((t) => tileKey(t.x, t.y)));
  const nearDoor = (x: number, y: number) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => doors.has(tileKey(x + dx, y + dy)));
  const reach = Math.ceil(lawnRadius) + 1;
  for (let y = -reach; y <= reach; y++)
    for (let x = -reach; x <= reach; x++) {
      if (baseTerrain(x, y) !== "lawn" || blocked.has(tileKey(x, y)) || nearDoor(x, y) || sites.some((s) => s.claims.some((c) => inRect(grow(c, 1), x, y)))) continue;
      const byPath = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => overlay.get(tileKey(x + dx, y + dy)) === "path");
      const r = noise(seed, x, y, 53);
      if (byPath && r < 0.09) {
        decor.push({ kind: "lantern", tile: { x, y } });
        blocked.add(tileKey(x, y));
      } else if (!byPath && r > 0.86) decor.push({ kind: "flowers", tile: { x, y } });
    }

  // Pools of light: under the tree, round each lantern post, and in front of each open place.
  const lights = [
    ...(planted ? [{ x: 0, y: 0, r: Math.max(3, lawnRadius * 0.75) + 1 }] : []),
    ...decor.filter((d) => d.kind === "lantern").map((d) => ({ x: d.tile.x, y: d.tile.y, r: 2.2 })),
    ...places.map((p) => ({ x: p.doors[0].x, y: p.doors[0].y, r: 2.6 })),
  ];

  const terrainAt = baseTerrain;
  return {
    seed,
    stage,
    planted,
    terrainAt,
    outlineAt: (x, y) => outlines.get(tileKey(x, y)) ?? null,
    walkable: (x, y) => {
      if (Math.abs(x) > WORLD_EDGE || Math.abs(y) > WORLD_EDGE || blocked.has(tileKey(x, y))) return false;
      const t = terrainAt(x, y);
      return t !== "fence" && desertWalkable(t);
    },
    cost: (x, y) => (["path", "gate"].includes(terrainAt(x, y)) ? 1 : 3),
    bounds: { x0: -WORLD_EDGE, y0: -WORLD_EDGE, x1: WORLD_EDGE, y1: WORLD_EDGE },
    spawn,
    trunk,
    props: BASE_CAMP.props,
    sites,
    places,
    plots,
    beds,
    ruins,
    homes,
    decor,
    lights,
    lawnRadius,
    rings,
  };
}

/** A smooth, seeded field in [0, 1) over the town (4-tile cells), for paths to wander by. */
function valueNoise2(seed: number, x: number, y: number) {
  const gx = Math.floor(x / 4);
  const gy = Math.floor(y / 4);
  const fx = x / 4 - gx;
  const fy = y / 4 - gy;
  const n = (i: number, j: number) => noise(seed, gx + i, gy + j, 55);
  const a = n(0, 0) + (n(1, 0) - n(0, 0)) * fx;
  const b = n(0, 1) + (n(1, 1) - n(0, 1)) * fx;
  return a + (b - a) * fy;
}

const isCorner = (r: Rect, x: number, y: number) => (x === r.x0 || x === r.x1) && (y === r.y0 || y === r.y1);
