/**
 * Palette-indexed pixel maps (#126): every tile, building, plant and sign in the world is drawn from
 * rows of characters, one character per pixel, in the dusk-garden palette. `.` is transparent.
 * `PixelCanvas` builds maps in code (iso boxes, roofs, an auto outline) for sprites that are
 * easier to describe than to type out; either way the result is a plain `PixelMap`.
 */

export const PALETTE: Record<string, string> = {
  k: "#161226", // dusk-deep: outlines and shade
  d: "#241e33", // dusk
  g: "#4f7a3c", // hedge
  G: "#2f5128", // hedge-deep
  u: "#6aa84f", // leaf light (uncommon)
  s: "#5a3b2a", // soil
  b: "#3a2a22", // bark
  p: "#efe3c4", // parchment
  P: "#d9c79c", // parchment-deep
  l: "#f7a501", // lantern
  e: "#f54e00", // ember
  E: "#a83800", // ember-deep
  w: "#2f80fa", // pond
  W: "#1e3f7a", // pond-deep
  i: "#1d1f27", // ink
  c: "#f6efe4", // cream
  m: "#b3ada4", // stone (the neutral benchmark grey)
  M: "#7d776f", // stone in shade
  v: "#8567ff", // violet (epic)
};

/** A sprite: equal-length rows of palette characters. `palette` adds or overrides colours. */
export type PixelMap = { rows: string[]; palette?: Record<string, string> };

export const mapWidth = (m: PixelMap) => m.rows[0]?.length ?? 0;
export const mapHeight = (m: PixelMap) => m.rows.length;

/** The colour of one pixel, or null where it's transparent. */
export function pixelAt(m: PixelMap, x: number, y: number): string | null {
  const ch = m.rows[y]?.[x];
  if (!ch || ch === "." || ch === " ") return null;
  return m.palette?.[ch] ?? PALETTE[ch] ?? null;
}

type Pt = [number, number];
/** An iso box drawn on a canvas: its top diamond's corners and its wall height. */
export type Box = { T: Pt; R: Pt; B: Pt; L: Pt; height: number };

function insidePolygon(x: number, y: number, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A small drawing surface of palette characters, for building sprites in code. */
export class PixelCanvas {
  readonly cells: string[][];
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.cells = Array.from({ length: height }, () => Array<string>(width).fill("."));
  }

  set(x: number, y: number, c: string) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.cells[y][x] = c;
    return this;
  }

  get(x: number, y: number) {
    return this.cells[y]?.[x] ?? ".";
  }

  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
    return this;
  }

  /** Fills every pixel whose centre lies inside the polygon. */
  polygon(points: Pt[], c: string) {
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) if (insidePolygon(x + 0.5, y + 0.5, points)) this.set(x, y, c);
    return this;
  }

  /** Stamps another map with its top-left at (x, y). */
  stamp(m: PixelMap, x: number, y: number) {
    m.rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== "." && this.set(x + i, y + j, ch)));
    return this;
  }

  /**
   * An isometric box on a footprint of `a` tiles along x and `b` along y, `height` px tall, sitting
   * with its bottom corner at the canvas's bottom centre line `baseY`. The left face takes `left`,
   * the right face `right`, the top `top`. Returns the top diamond's corners for roofs.
   */
  isoBox(a: number, b: number, height: number, colours: { left: string; right: string; top: string }, baseY = this.height, x0 = 0) {
    const top = baseY - (a + b) * 4 - height;
    const T: Pt = [x0 + b * 8, top];
    const R: Pt = [x0 + (a + b) * 8, top + a * 4];
    const B: Pt = [x0 + a * 8, top + (a + b) * 4];
    const L: Pt = [x0, top + b * 4];
    const down = (p: Pt): Pt => [p[0], p[1] + height];
    this.polygon([L, B, down(B), down(L)], colours.left);
    this.polygon([B, R, down(R), down(B)], colours.right);
    this.polygon([T, R, B, L], colours.top);
    return { T, R, B, L, height };
  }

  /**
   * Paints a patch `w` px wide and `h` px tall on a box's left or right wall (a window, a door, a
   * banner), `u` px along the wall from its front corner and `v` px up from the ground. The patch
   * follows the wall's slope, one pixel up every two across.
   */
  wall(box: Box, side: "left" | "right", u: number, v: number, w: number, h: number, c: string) {
    const groundY = box.B[1] + box.height;
    for (let i = 0; i < w; i++) {
      const x = side === "right" ? box.B[0] + u + i : box.B[0] - 1 - u - i;
      const base = groundY - Math.floor((u + i) / 2);
      for (let j = 0; j < h; j++) this.set(x, base - v - j - 1, c);
    }
    return this;
  }

  /** A filled circle (canopies, domes, bushes). */
  disc(cx: number, cy: number, r: number, c: string) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, c);
    return this;
  }

  /** A hip roof over a diamond: four faces up to an apex `rise` px above its centre. */
  hipRoof(d: Box, rise: number, colours: { front: string; side: string; back: string }) {
    const apex: Pt = [(d.L[0] + d.R[0]) / 2, (d.T[1] + d.B[1]) / 2 - rise];
    this.polygon([d.T, d.R, apex], colours.back);
    this.polygon([d.T, d.L, apex], colours.back);
    this.polygon([d.L, d.B, apex], colours.side);
    this.polygon([d.B, d.R, apex], colours.front);
    return apex;
  }

  /** A 1 px outline in `c` round everything drawn so far (the pixel-art edge). */
  outline(c = "k") {
    const filled = this.cells.map((row) => row.map((ch) => ch !== "."));
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        if (filled[y][x]) continue;
        if (filled[y - 1]?.[x] || filled[y + 1]?.[x] || filled[y][x - 1] || filled[y][x + 1]) this.cells[y][x] = c;
      }
    return this;
  }

  map(palette?: Record<string, string>): PixelMap {
    return { rows: this.cells.map((row) => row.join("")), palette };
  }
}
