import { TILE_H, TILE_W, tileCentre, type Point, type Tile } from "./iso";
import type { PlaceDef } from "./places";
import { PALETTE, mapHeight, mapWidth, pixelAt, type PixelMap } from "./pixels";
import { DECOR_SPRITES, GROUND, GROUND_OF, MAP_H, MAP_W, hash, type Terrain, type World } from "./tiles";

/**
 * Paints the world into an RGBA buffer (an `ImageData`), pixel by pixel at art scale: the canvas
 * then shows it scaled up by a whole number with `image-rendering: pixelated`. Painting is pure
 * and happens once per change of what's on the map, never per frame; only the pond's two
 * shimmer frames are kept as a second, water-only layer.
 */

/** Art pixels round the map for the sky, the tallest sprites and the signs above them. */
const MARGIN = { x: 16, top: 56, bottom: 16 };
/** Where map point (0, 0) sits on the canvas. */
export const ORIGIN: Point = { x: MAP_H * (TILE_W / 2) + MARGIN.x, y: MARGIN.top };
export const CANVAS_W = (MAP_W + MAP_H) * (TILE_W / 2) + 2 * MARGIN.x;
export const CANVAS_H = (MAP_W + MAP_H) * (TILE_H / 2) + MARGIN.top + MARGIN.bottom;
/** How high raised ground (your garden, the hedge) stands, in art pixels. */
const LIFT: Partial<Record<Terrain, number>> = { garden: 3, fence: 3, gate: 3, plot: 3, hedge: 5 };

export type Pixels = { width: number; height: number; data: Uint8ClampedArray };

/**
 * What grows on the map: the neighbours' beds (each with its plant, a sprout if none is given) and
 * your plot tiles (`world.plots`, in order): a key bed with its plant, or null where the lawn is
 * still lawn (#129, `gardenWorld.ts`). `key` names the drawing, so the canvas repaints on a change.
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

function put(img: Pixels, x: number, y: number, hex: string) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  const [r, g, b] = rgb(hex);
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
  img.data[i + 3] = 255;
}

/** Canvas position of a map point. */
export const toCanvas = (p: Point): Point => ({ x: p.x + ORIGIN.x, y: p.y + ORIGIN.y });

function stamp(img: Pixels, m: PixelMap, left: number, top: number) {
  for (let y = 0; y < mapHeight(m); y++)
    for (let x = 0; x < mapWidth(m); x++) {
      const c = pixelAt(m, x, y);
      if (c) put(img, left + x, top + y, c);
    }
}

/** Stamps a sprite with its bottom centre on a map point. */
function stand(img: Pixels, m: PixelMap, foot: Point) {
  const at = toCanvas(foot);
  stamp(img, m, Math.round(at.x - mapWidth(m) / 2), Math.round(at.y - mapHeight(m) + 1));
}

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

/** The pixels of one tile's diamond, lifted by `lift`, sampling its ground at map position. */
function paintTile(img: Pixels, t: Tile, ground: PixelMap, lift: number) {
  const c = toCanvas(tileCentre(t));
  for (let dy = -TILE_H / 2; dy < TILE_H / 2; dy++)
    for (let dx = -TILE_W / 2; dx < TILE_W / 2; dx++) {
      if (Math.abs(dx + 0.5) / (TILE_W / 2) + Math.abs(dy + 0.5) / (TILE_H / 2) > 1) continue;
      const x = c.x + dx;
      const y = c.y + dy - lift;
      const colour = pixelAt(ground, ((x % 16) + 16) % 16, ((y + lift) % 16 + 16) % 16);
      if (colour) put(img, x, y, colour);
    }
}

/**
 * The sides under raised ground where it meets lower ground: the front-left side along +y, the
 * front-right along +x, `lift` pixels tall, in soil (the garden) or deep hedge.
 */
function paintSides(img: Pixels, t: Tile, lift: number, drop: { x: boolean; y: boolean }, colours: { left: string; right: string; lip: string }) {
  const c = toCanvas(tileCentre(t));
  const bottom = { x: c.x, y: c.y + TILE_H / 2 };
  for (let i = 0; i < TILE_W / 2; i++) {
    const rise = Math.floor(i / 2);
    for (let j = 0; j < lift; j++) {
      if (drop.x) put(img, bottom.x + i, bottom.y - rise - j - 1, j === lift - 1 ? colours.lip : colours.right);
      if (drop.y) put(img, bottom.x - 1 - i, bottom.y - rise - j - 1, j === lift - 1 ? colours.lip : colours.left);
    }
  }
}

function line(img: Pixels, a: Point, b: Point, hex: string) {
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  for (let i = 0; i <= steps; i++) put(img, a.x + ((b.x - a.x) * i) / (steps || 1), a.y + ((b.y - a.y) * i) / (steps || 1), hex);
}

function paintStars(img: Pixels) {
  for (let y = 0; y < img.height; y += 3)
    for (let x = 0; x < img.width; x += 3) {
      const r = hash(x, y, 21);
      if (r < 0.012) put(img, x, y, r < 0.004 ? PALETTE.p : PALETTE.M);
    }
}

type Drawable = { depth: number; draw: () => void };

/** Paints the whole world: sky, ground, and everything standing on it in depth order. */
export function paintWorld(img: Pixels, world: World, places: PlaceDef[], furniture: WorldFurniture, frame = 0) {
  paintStars(img);
  const lift = (x: number, y: number) => LIFT[world.terrainAt(x, y)] ?? 0;
  // Ground, back to front, so raised tiles and their sides overlap what's behind them.
  for (let d = 0; d < MAP_W + MAP_H; d++)
    for (let x = 0; x < MAP_W; x++) {
      const y = d - x;
      if (y < 0 || y >= MAP_H) continue;
      const terrain = world.terrainAt(x, y);
      const kind = GROUND_OF[terrain];
      if (!kind) continue;
      const frames = GROUND[kind];
      const h = lift(x, y);
      paintTile(img, { x, y }, frames[frame % frames.length], h);
      if (h > 0) {
        const drop = { x: lift(x + 1, y) < h, y: lift(x, y + 1) < h };
        const hedge = terrain === "hedge";
        paintSides(img, { x, y }, h, drop, hedge ? { left: PALETTE.G, right: PALETTE.k, lip: PALETTE.G } : { left: PALETTE.s, right: PALETTE.b, lip: PALETTE.g });
      }
    }

  // Plot tiles that aren't yours (yet) are lawn.
  world.plots.forEach((t, i) => {
    if (!furniture.plots[i]) paintTile(img, t, GROUND.garden[0], lift(t.x, t.y));
  });

  const items: Drawable[] = [];
  const at = (t: Tile, extra = 0) => {
    const c = tileCentre(t);
    return { x: c.x, y: c.y + TILE_H / 2 - 1 - lift(t.x, t.y) + extra };
  };
  for (const { kind, tile } of world.decor) {
    if (kind === "flowers") {
      const m = DECOR_SPRITES.flowers[Math.floor(hash(tile.x, tile.y, 9) * DECOR_SPRITES.flowers.length)];
      items.push({ depth: tile.x + tile.y - 0.5, draw: () => stand(img, m, at(tile, -1)) });
    } else items.push({ depth: tile.x + tile.y, draw: () => stand(img, DECOR_SPRITES[kind], at(tile)) });
  }
  // The fence round your garden: a post on each fence tile, rails to its fence neighbours.
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (world.terrainAt(x, y) !== "fence") continue;
      items.push({
        depth: x + y + 0.1,
        draw: () => {
          const foot = toCanvas(at({ x, y }, -2));
          for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
            if (world.terrainAt(x + dx, y + dy) !== "fence") continue;
            const to = toCanvas(at({ x: x + dx, y: y + dy }, -2));
            line(img, { x: foot.x, y: foot.y - 3 }, { x: to.x, y: to.y - 3 }, PALETTE.s);
            line(img, { x: foot.x, y: foot.y - 5 }, { x: to.x, y: to.y - 5 }, PALETTE.P);
          }
          for (let j = 0; j < 7; j++) put(img, foot.x, foot.y - j, j === 6 ? PALETTE.P : PALETTE.b);
        },
      });
    }
  for (const bed of furniture.beds) items.push({ depth: bed.tile.x + bed.tile.y, draw: () => stand(img, bed.sprite ?? DECOR_SPRITES.sprout, at(bed.tile, -1)) });
  // A key bed's sprite has its key's top centred 9 px above its bottom row: over the plot tile.
  furniture.plots.slice(0, world.plots.length).forEach((m, i) => {
    const tile = world.plots[i];
    if (m) items.push({ depth: tile.x + tile.y, draw: () => stand(img, m, at(tile, 5)) });
  });
  for (const p of places) {
    const { x, y, w, h } = p.footprint;
    const depth = p.spriteAt ? p.spriteAt.x + p.spriteAt.y : x + w - 1 + y + h - 1;
    items.push({ depth: depth + 0.2, draw: () => stand(img, p.sprite, spriteFoot(p)) });
  }
  items.sort((a, b) => a.depth - b.depth);
  for (const item of items) item.draw();
}

/**
 * The pond's second shimmer frame as a clear layer over the painted world: only the pixels that
 * change between the two frames, and only where the water still shows (not under rim stones or
 * lily pads).
 */
export function paintShimmer(layer: Pixels, base: Pixels, world: World) {
  const [a, b] = GROUND.water;
  for (let ty = 0; ty < MAP_H; ty++)
    for (let tx = 0; tx < MAP_W; tx++) {
      if (world.terrainAt(tx, ty) !== "water") continue;
      const c = toCanvas(tileCentre({ x: tx, y: ty }));
      for (let dy = -TILE_H / 2; dy < TILE_H / 2; dy++)
        for (let dx = -TILE_W / 2; dx < TILE_W / 2; dx++) {
          if (Math.abs(dx + 0.5) / (TILE_W / 2) + Math.abs(dy + 0.5) / (TILE_H / 2) > 1) continue;
          const [x, y] = [c.x + dx, c.y + dy];
          const [u, v] = [((x % 16) + 16) % 16, ((y % 16) + 16) % 16];
          const from = pixelAt(a, u, v)!;
          const to = pixelAt(b, u, v)!;
          if (from === to) continue;
          const i = (y * base.width + x) * 4;
          const [r, g, bl] = rgb(from);
          if (base.data[i] === r && base.data[i + 1] === g && base.data[i + 2] === bl) put(layer, x, y, to);
        }
    }
}

/** A tile's centre on the canvas, for the hedgehog and the camera. */
export const tileOnCanvas = (t: Tile) => toCanvas(tileCentre(t));
