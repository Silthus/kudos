import { CHUNK } from "./desert";
import { TILE_H, TILE_W, tileCentre, type Point, type Tile } from "./iso";
import type { PlaceDef } from "./places";
import { mapHeight, mapWidth, PALETTE, pixelAt, type PixelMap } from "./pixels";
import { DECOR_SPRITES, DUSK, GROUND, GROUND_OF, LIFT, NIGHT, hash } from "./tiles";
import { treeSprite } from "./tree/sprite";
import { TREE_STAGES, stageIndex } from "../../convex/lib/tree";
import type { Site, Terrain, World } from "./world";

/**
 * Paints the world into RGBA buffers (`ImageData`), pixel by pixel at art scale; the canvases then
 * show them scaled up by a whole number with `image-rendering: pixelated`. Painting is pure and never
 * per frame. The plane has no edge, so there's no one picture of it (#156):
 *
 * - The **ground** is painted a chunk at a time (`paintGround`, 32 × 32 tiles), only for the chunks
 *   on screen: sand, dunes, rock, oases, the tree's lawn, paths, the terrace, and the dry outlines
 *   of closed districts, ruins and home plots. Sand beyond the tree's light is night-sand.
 * - Everything **standing** (the tree, the places, base camp, plants, lanterns) is one picture of
 *   the town round the tree (`paintStanding`), painted in depth order over the ground.
 *
 * Art coordinates put the top corner of tile (0, 0), the tree's own tile, at (0, 0); an image is
 * painted for a rectangle of art space (`ArtRect`), so its pixel (0, 0) is the rectangle's corner.
 */

export type Pixels = { width: number; height: number; data: Uint8ClampedArray };
export type ArtRect = { x: number; y: number; width: number; height: number };

/**
 * What grows on the terrace: the neighbours' beds (each with its plant, a sprout if none is given)
 * and your plot tiles (`world.plots`, in planting order): a key bed with its plant, or null where
 * the lawn is still lawn (#129, `gardenWorld.ts`). `key` names the drawing, so it repaints on a change.
 */
export type WorldFurniture = { beds: { tile: Tile; sprite?: PixelMap }[]; plots: (PixelMap | null)[]; key?: string };

const rgbCache = new Map<string, [number, number, number]>();
function rgb(hex: string): [number, number, number] {
  let c = rgbCache.get(hex);
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, c);
  }
  return c;
}

/** Puts a colour at an art point, if it falls in the image. */
function put(img: Pixels, at: ArtRect, x: number, y: number, hex: string) {
  x = Math.round(x - at.x);
  y = Math.round(y - at.y);
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  const [r, g, b] = rgb(hex);
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
  img.data[i + 3] = 255;
}

function stamp(img: Pixels, at: ArtRect, m: PixelMap, left: number, top: number) {
  for (let y = 0; y < mapHeight(m); y++)
    for (let x = 0; x < mapWidth(m); x++) {
      const c = pixelAt(m, x, y);
      if (c) put(img, at, left + x, top + y, c);
    }
}

/** Where a sprite with its bottom centre on `foot` covers. */
const spriteBox = (m: PixelMap, foot: Point): ArtRect => ({ x: Math.round(foot.x - mapWidth(m) / 2), y: Math.round(foot.y - mapHeight(m) + 1), width: mapWidth(m), height: mapHeight(m) });

/** The map point a place's sprite stands on: its footprint's front corner, or its `spriteAt` tile. */
export function spriteFoot(p: PlaceDef): Point {
  const off = p.spriteOffset ?? { x: 0, y: 0 };
  if (p.spriteAt) {
    const c = tileCentre(p.spriteAt);
    return { x: c.x + off.x, y: c.y + TILE_H / 2 + off.y };
  }
  const { x, y, w, h } = p.footprint;
  const left = tileCentre({ x, y: y + h - 1 }).x - TILE_W / 2;
  const right = tileCentre({ x: x + w - 1, y }).x + TILE_W / 2;
  const bottom = tileCentre({ x: x + w - 1, y: y + h - 1 }).y + TILE_H / 2;
  return { x: (left + right) / 2 + off.x, y: bottom + off.y };
}

/** How many rows at the top of a sprite are empty. */
const emptyTop = (m: PixelMap) => Math.max(0, m.rows.findIndex((row) => /[^. ]/.test(row)));

/** Where a place's name sign hangs: just above the top of its sprite, in map points. */
export function signPoint(p: PlaceDef): Point {
  const foot = spriteFoot(p);
  const off = p.signOffset ?? { x: 0, y: 0 };
  return { x: foot.x + off.x, y: foot.y - mapHeight(p.sprite) + emptyTop(p.sprite) - 2 + off.y };
}

type Box = { x0: number; y0: number; x1: number; y1: number };
const meets = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
/**
 * A sign's box and a hedgehog's at a door, in art pixels at the world's smaller scale (2×, a phone),
 * where both are biggest: the sign is 14 px Pixelify text (about 8 px a letter) with 8 px padding a
 * side and 24 px tall, the hedgehog about 48 × 44 px above its feet. Clear at 2× is clear at 3×.
 */
const signBox = (name: string, at: Point): Box => {
  const half = (name.length * 8 + 16) / 4;
  return { x0: at.x - half, x1: at.x + half, y0: at.y - 12, y1: at.y };
};
const hogBox = (door: Tile): Box => {
  const feet = tileCentre(door);
  return { x0: feet.x - 12, x1: feet.x + 12, y0: feet.y - 22, y1: feet.y + 2 };
};

/**
 * Where every place's name sign and every label hangs: above its sprite (or its point), or, where
 * that would sit behind a hedgehog at a door (the tree's layout packs districts close) or over
 * another sign, the nearest spot to the side, above, or at its foot. In a fixed order, so it's the
 * same every time. A label with no clear spot is left out (missing from the map).
 */
export function signPoints(places: PlaceDef[], labels: Label[] = [], standing: Tile[] = []): Map<string, Point> {
  // Where a hedgehog stands: at every door, and wherever else one waits (you arriving, the elder hog).
  const doors = [...places.flatMap((p) => p.doors), ...standing].map(hogBox);
  const taken: Box[] = [];
  const out = new Map<string, Point>();
  const signs = [
    ...places.map((p) => ({ id: p.id, name: p.name, home: signPoint(p), below: mapHeight(p.sprite) - emptyTop(p.sprite) + 16, place: true })),
    ...labels.map((l) => ({ id: l.id, name: l.name, home: l.at, below: 16, place: false })),
  ];
  for (const p of signs) {
    const { home, below } = p;
    // A place's sign may move well aside; a label stays by what it names, or it would name something else.
    const tries = p.place
      ? [0, -14, below, -28, below + 14, -42].flatMap((dy) => [0, -12, 12, -24, 24, -36, 36, -48, 48, -60, 60, -72, 72].map((dx) => ({ x: dx, y: dy })))
      : [0, -14, -28].flatMap((dy) => [0, -12, 12].map((dx) => ({ x: dx, y: dy })));
    const spots = tries.map((d) => ({ x: home.x + d.x, y: home.y + d.y }));
    const clearOfDoors = (at: Point) => !doors.some((b) => meets(signBox(p.name, at), b));
    // Clear of everything. Failing that, a place's sign at least keeps clear of the doors, where a
    // hedgehog would hide it; a label (a marker's name, the elder's) is left out rather than crowd one.
    const clear = spots.find((at) => clearOfDoors(at) && !taken.some((b) => meets(signBox(p.name, at), b)));
    if (!clear && !p.place) continue;
    const spot = clear ?? spots.find(clearOfDoors) ?? home;
    taken.push(signBox(p.name, spot));
    out.set(p.id, spot);
  }
  return out;
}

/** A name hanging over the world that isn't a place's own sign: the elder hog, a district's marker, a closed district. */
export type Label = { id: string; name: string; at: Point };

/** The name a district goes by on the map: its place's, where it has one (the store stall, not the stall). */
export const siteName = (s: Site) => (s.places.length === 1 ? s.places[0].name : s.name);

/**
 * Every label over the world but the places' signs: the elder hog over its head, an open district
 * without a place over its marker, and the districts the tree's next stage opens, dim, over their
 * outlines. The rest of the closed districts wait unnamed. `signPoints` keeps them all clear.
 */
export function labelsOf(world: World): Label[] {
  const labels: Label[] = [];
  const elder = world.props.find((p) => p.kind === "elder");
  if (elder) labels.push({ id: "elder", name: "The elder hog", at: { x: tileCentre(elder.tile).x, y: tileCentre(elder.tile).y + 4 - ELDER_HEIGHT } });
  for (const s of world.sites) {
    if (s.open && !s.places.length && s.id !== "base_camp") labels.push({ id: `district:${s.id}`, name: s.name, at: { x: tileCentre(s.at).x, y: tileCentre(s.at).y - 22 } });
  }
  const next = TREE_STAGES[stageIndex(world.stage) + 1]?.id;
  if (world.planted)
    for (const s of world.sites)
      if (!s.open && s.opens === next) {
        const back = tileCentre({ x: s.outline.x0, y: s.outline.y0 });
        const front = tileCentre({ x: s.outline.x1, y: s.outline.y1 });
        labels.push({ id: `closed:${s.id}`, name: siteName(s), at: { x: (back.x + front.x) / 2, y: (back.y + front.y) / 2 - 6 } });
      }
  return labels;
}
/** Where hedgehogs stand in the world besides the doors: you where you arrive, and the elder hog. Signs keep clear of them too. */
export function hogsOf(world: World): Tile[] {
  return [world.spawn, ...world.props.filter((p) => p.kind === "elder").map((p) => p.tile)];
}

/** How high the elder hog's label hangs over its feet, in art pixels: over its head at either scale. */
const ELDER_HEIGHT = 36;

/** Where the tree's sprite covers, in art pixels; null before the seed is planted. */
export function treeBox(world: World): ArtRect | null {
  return world.trunk ? spriteBox(treeSprite(world.stage, world.seed, world.rings), treeFoot(world)) : null;
}

/** How tall the tree stands, in art pixels (0 before the seed is planted). */
export function treeHeight(world: World) {
  return treeBox(world)?.height ?? 0;
}

/** Where the tree's sprite stands: the front corner of its trunk. */
export function treeFoot(world: World): Point {
  const t = world.trunk ?? { x1: 0, y1: 0 };
  return { x: 0, y: tileCentre({ x: t.x1, y: t.y1 }).y + TILE_H / 2 };
}

// ---------------------------------------------------------------------------------------------
// The ground, a chunk at a time.

/** The art rectangle a chunk's canvas covers: its tiles' diamonds, with room above for raised rock. */
export function chunkRect(cx: number, cy: number): ArtRect {
  const x0 = cx * CHUNK;
  const y0 = cy * CHUNK;
  const top = (x0 + y0) * (TILE_H / 2);
  return { x: (x0 - (y0 + CHUNK - 1)) * (TILE_W / 2) - TILE_W / 2, y: top - 8, width: 2 * CHUNK * (TILE_W / 2), height: 2 * CHUNK * (TILE_H / 2) + 8 };
}

/** The chunks whose canvases a view of art space (plus a margin) touches. */
export function chunksIn(view: ArtRect, margin = 64): { cx: number; cy: number }[] {
  const x0 = view.x - margin;
  const x1 = view.x + view.width + margin;
  const y0 = view.y - margin;
  const y1 = view.y + view.height + margin;
  // A screen point (x, y) is tile ((y/4 + x/8)/2, (y/4 − x/8)/2): take the corners' tile range.
  const tiles = [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ].map(([x, y]) => ({ tx: (y / (TILE_H / 2) + x / (TILE_W / 2)) / 2, ty: (y / (TILE_H / 2) - x / (TILE_W / 2)) / 2 }));
  const cx0 = Math.floor(Math.min(...tiles.map((t) => t.tx)) / CHUNK) - 1;
  const cx1 = Math.floor(Math.max(...tiles.map((t) => t.tx)) / CHUNK) + 1;
  const cy0 = Math.floor(Math.min(...tiles.map((t) => t.ty)) / CHUNK) - 1;
  const cy1 = Math.floor(Math.max(...tiles.map((t) => t.ty)) / CHUNK) + 1;
  const out: { cx: number; cy: number }[] = [];
  for (let cy = cy0; cy <= cy1; cy++)
    for (let cx = cx0; cx <= cx1; cx++) {
      const r = chunkRect(cx, cy);
      if (r.x < x1 && r.x + r.width > x0 && r.y < y1 && r.y + r.height > y0) out.push({ cx, cy });
    }
  // Back to front, so a chunk in front lies over the rock of the one behind it.
  return out.sort((a, b) => a.cx + a.cy - (b.cx + b.cy) || a.cx - b.cx);
}

/**
 * How dark the sand is at a tile: 0 in the tree's light, 1 in the dusk round it, 2 in the night
 * beyond. Hard steps with a ragged tile edge, as light falls off in pixel art; wider as the tree grows.
 */
function nightAt(world: World, x: number, y: number) {
  const light = world.planted ? 22 + world.lawnRadius * 2 : 18;
  const d = Math.hypot(x, y) - light + (hash(x, y, 72) - 0.5) * 2.5;
  return d < 0 ? 0 : d < 8 ? 1 : 2;
}

/** Sand's colours by hex, to their night colours. */
const NIGHT_HEX: Record<string, string> = Object.fromEntries(Object.entries(NIGHT).map(([day, night]) => [PALETTE[day], PALETTE[night]]));
const DUSK_HEX: Record<string, string> = Object.fromEntries(Object.entries(DUSK).map(([day, dusk]) => [PALETTE[day], PALETTE[dusk]]));

const lift = (world: World, x: number, y: number) => LIFT[world.terrainAt(x, y)] ?? 0;

/** One tile's diamond, lifted by `h`, sampling its ground at map position. */
function paintTile(img: Pixels, at: ArtRect, t: Tile, ground: PixelMap, h: number, night: number) {
  const c = tileCentre(t);
  for (let dy = -TILE_H / 2; dy < TILE_H / 2; dy++)
    for (let dx = -TILE_W / 2; dx < TILE_W / 2; dx++) {
      if (Math.abs(dx + 0.5) / (TILE_W / 2) + Math.abs(dy + 0.5) / (TILE_H / 2) > 1) continue;
      const x = c.x + dx;
      const y = c.y + dy - h;
      let colour = pixelAt(ground, ((x % 16) + 16) % 16, ((((y + h) % 16) + 16) % 16));
      if (!colour) continue;
      if (night > 0) colour = (night === 1 ? DUSK_HEX : NIGHT_HEX)[colour] ?? colour;
      put(img, at, x, y, colour);
    }
}

/** The sides under raised ground where it meets lower ground. */
function paintSides(img: Pixels, at: ArtRect, t: Tile, h: number, drop: { x: boolean; y: boolean }, colours: { left: string; right: string; lip: string }) {
  const c = tileCentre(t);
  const bottom = { x: c.x, y: c.y + TILE_H / 2 };
  for (let i = 0; i < TILE_W / 2; i++) {
    const rise = Math.floor(i / 2);
    for (let j = 0; j < h; j++) {
      if (drop.x) put(img, at, bottom.x + i, bottom.y - rise - j - 1, j === h - 1 ? colours.lip : colours.right);
      if (drop.y) put(img, at, bottom.x - 1 - i, bottom.y - rise - j - 1, j === h - 1 ? colours.lip : colours.left);
    }
  }
}

const SIDES: Partial<Record<Terrain, { left: string; right: string; lip: string }>> = {
  rock: { left: PALETTE.D, right: PALETTE.b, lip: PALETTE.A },
};
const TERRACE_SIDES = { left: PALETTE.s, right: PALETTE.b, lip: PALETTE.g };

/**
 * A dry outline: dashes along the edges of the tiles it rings (a stone course for a ruin), each a
 * groove with a lit lip over it, dark enough to read on sand, dune and night alike.
 */
const OUTLINE_COLOURS = { closed: [PALETTE.b, PALETTE.a], ruin: [PALETTE.M, PALETTE.m], home: [PALETTE.b, PALETTE.P] } as const;

function paintOutline(img: Pixels, at: ArtRect, world: World, t: Tile) {
  const kind = world.outlineAt(t.x, t.y);
  if (!kind) return;
  const [dash, gap] = OUTLINE_COLOURS[kind];
  const c = tileCentre(t);
  const corners = { top: { x: c.x, y: c.y - 4 }, right: { x: c.x + 8, y: c.y }, bottom: { x: c.x, y: c.y + 4 }, left: { x: c.x - 8, y: c.y } };
  const edges: [Tile, Point, Point][] = [
    [{ x: t.x, y: t.y - 1 }, corners.top, corners.right],
    [{ x: t.x - 1, y: t.y }, corners.top, corners.left],
    [{ x: t.x + 1, y: t.y }, corners.right, corners.bottom],
    [{ x: t.x, y: t.y + 1 }, corners.left, corners.bottom],
  ];
  for (const [n, a, b] of edges) {
    if (world.outlineAt(n.x, n.y) === kind) continue;
    for (let i = 0; i <= 8; i++) {
      const x = a.x + ((b.x - a.x) * i) / 8;
      const y = a.y + ((b.y - a.y) * i) / 8;
      const on = kind === "ruin" || (Math.floor((x + y) / 2) + t.x + t.y) % 3 !== 0;
      if (!on) continue;
      put(img, at, x, y, kind === "ruin" && i % 3 === 0 ? gap : dash);
      put(img, at, x, y - 1, gap);
    }
  }
  // Cracks in the dry ground inside.
  if (kind !== "ruin" && hash(t.x, t.y, 73) < 0.3) put(img, at, c.x + Math.round((hash(t.x, t.y, 74) - 0.5) * 8), c.y, PALETTE.D);
}

/**
 * Paints the ground of a block of tiles (a chunk, or any `tiles` rect) into an image covering `at`,
 * back to front, with water's frame `frame`.
 */
export function paintGround(img: Pixels, at: ArtRect, world: World, tiles: { x0: number; y0: number; x1: number; y1: number }, frame = 0) {
  for (let d = tiles.x0 + tiles.y0; d <= tiles.x1 + tiles.y1; d++)
    for (let x = tiles.x0; x <= tiles.x1; x++) {
      const y = d - x;
      if (y < tiles.y0 || y > tiles.y1) continue;
      const terrain = world.terrainAt(x, y);
      const frames = GROUND[GROUND_OF[terrain]];
      const h = lift(world, x, y);
      const night = terrain === "sand" || terrain === "dune" || terrain === "ridge" || terrain === "rock" ? nightAt(world, x, y) : 0;
      paintTile(img, at, { x, y }, frames[frame % frames.length], h, night);
      if (h > 0) {
        const drop = { x: lift(world, x + 1, y) < h, y: lift(world, x, y + 1) < h };
        paintSides(img, at, { x, y }, h, drop, SIDES[terrain] ?? TERRACE_SIDES);
      }
      paintOutline(img, at, world, { x, y });
    }
}

/**
 * The water's second shimmer frame as a clear layer over painted ground: only the pixels that change
 * between the two frames. Null when there's no water in the block.
 */
export function paintShimmer(layer: Pixels, at: ArtRect, world: World, tiles: { x0: number; y0: number; x1: number; y1: number }): boolean {
  const [a, b] = GROUND.water;
  let any = false;
  for (let ty = tiles.y0; ty <= tiles.y1; ty++)
    for (let tx = tiles.x0; tx <= tiles.x1; tx++) {
      if (world.terrainAt(tx, ty) !== "water") continue;
      any = true;
      const c = tileCentre({ x: tx, y: ty });
      for (let dy = -TILE_H / 2; dy < TILE_H / 2; dy++)
        for (let dx = -TILE_W / 2; dx < TILE_W / 2; dx++) {
          if (Math.abs(dx + 0.5) / (TILE_W / 2) + Math.abs(dy + 0.5) / (TILE_H / 2) > 1) continue;
          const [x, y] = [c.x + dx, c.y + dy];
          const [u, v] = [((x % 16) + 16) % 16, ((y % 16) + 16) % 16];
          const to = pixelAt(b, u, v)!;
          if (pixelAt(a, u, v) !== to) put(layer, at, x, y, to);
        }
    }
  return any;
}

// ---------------------------------------------------------------------------------------------
// Everything standing, round the tree.

type Drawable = { depth: number; sprite: PixelMap; foot: Point };

/** What stands in the world, each with its sprite, where it stands and its depth. */
function standing(world: World, furniture: WorldFurniture, extra: { tree?: boolean } = {}): Drawable[] {
  const items: Drawable[] = [];
  const onTile = (t: Tile, extraY = 0) => {
    const c = tileCentre(t);
    return { x: c.x, y: c.y + TILE_H / 2 - 1 - lift(world, t.x, t.y) + extraY };
  };
  if (world.trunk && extra.tree !== false) {
    const rings = world.rings;
    items.push({ depth: world.trunk.x1 + world.trunk.y1 + 0.3, sprite: treeSprite(world.stage, world.seed, rings), foot: treeFoot(world) });
  }
  for (const p of world.props) if (p.kind !== "elder") items.push({ depth: p.tile.x + p.tile.y, sprite: DECOR_SPRITES[p.kind], foot: onTile(p.tile) });
  for (const d of world.decor) {
    const sprite = d.kind === "flowers" ? DECOR_SPRITES.flowers[Math.floor(hash(d.tile.x, d.tile.y, 9) * DECOR_SPRITES.flowers.length)] : DECOR_SPRITES.lantern;
    items.push({ depth: d.tile.x + d.tile.y - (d.kind === "flowers" ? 0.5 : 0), sprite, foot: onTile(d.tile, d.kind === "flowers" ? -1 : 0) });
  }
  for (const s of world.sites) if (s.open && !s.places.length && s.id !== "base_camp") items.push({ depth: s.at.x + s.at.y, sprite: DECOR_SPRITES.marker, foot: onTile(s.at) });
  // The fence round the terrace: a post on each fence tile.
  for (const p of world.places) {
    if (!p.ground) continue;
    const { x, y, w, h } = p.footprint;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (world.terrainAt(i, j) === "fence") items.push({ depth: i + j + 0.1, sprite: FENCE_POST, foot: onTile({ x: i, y: j }, -1) });
  }
  furniture.beds.forEach((bed) => items.push({ depth: bed.tile.x + bed.tile.y, sprite: bed.sprite ?? DECOR_SPRITES.sprout, foot: onTile(bed.tile, -1) }));
  // A key bed's sprite has its key's top centred 9 px above its bottom row: over the plot tile.
  furniture.plots.slice(0, world.plots.length).forEach((m, i) => {
    if (m) items.push({ depth: world.plots[i].x + world.plots[i].y, sprite: m, foot: onTile(world.plots[i], 5) });
  });
  for (const p of world.places) {
    const { x, y, w, h } = p.footprint;
    const depth = p.spriteAt ? p.spriteAt.x + p.spriteAt.y : x + w - 1 + y + h - 1;
    items.push({ depth: depth + 0.2, sprite: p.sprite, foot: spriteFoot(p) });
  }
  return items.sort((a, b) => a.depth - b.depth);
}

/** A fence post with a rail: the terrace's low fence. */
const FENCE_POST: PixelMap = { rows: ["P.", "bs", "bs", "bs", "bs", "bs", "b."] };

/** The art rectangle everything standing covers (with a pixel to spare). */
export function standingRect(world: World, furniture: WorldFurniture): ArtRect {
  const boxes = standing(world, furniture).map((d) => spriteBox(d.sprite, d.foot));
  if (!boxes.length) return { x: 0, y: 0, width: 1, height: 1 };
  const x0 = Math.min(...boxes.map((b) => b.x)) - 1;
  const y0 = Math.min(...boxes.map((b) => b.y)) - 1;
  const x1 = Math.max(...boxes.map((b) => b.x + b.width)) + 1;
  const y1 = Math.max(...boxes.map((b) => b.y + b.height)) + 1;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Paints everything standing into an image covering `at`, back to front. `tree: false` leaves the tree out (the seed moment draws its own). */
export function paintStanding(img: Pixels, at: ArtRect, world: World, furniture: WorldFurniture, extra: { tree?: boolean } = {}) {
  for (const d of standing(world, furniture, extra)) {
    const box = spriteBox(d.sprite, d.foot);
    stamp(img, at, d.sprite, box.x, box.y);
  }
}

/** A tile's centre in art space, for the hedgehog and the camera. */
export const tileOnCanvas = (t: Tile) => tileCentre(t);
