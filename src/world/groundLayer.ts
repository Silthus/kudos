import { CHUNK } from "./desert";
import { chunkRect, chunksIn, paintGround, paintShimmer, type ArtRect } from "./paint";
import { SHIMMER_MS } from "./tiles";
import type { World } from "./world";

/**
 * The ground on screen (#156): one canvas per 32 × 32 chunk, added as the camera comes near and
 * dropped as it leaves, painted off React's render path. The camera calls `show` with what it sees
 * on every move; nothing happens until the chunks in view change. The first paint of a world
 * paints what's on screen at once; after that, chunks coming into view are painted a few a frame.
 * A chunk with water gets a second canvas for the water's other frame, and those blink together,
 * slowly (not under reduced motion).
 */

type Tiles = { x0: number; y0: number; x1: number; y1: number };
type Painted = { base: HTMLCanvasElement; shimmer: HTMLCanvasElement | null };

/** Chunks painted and kept for a walk back: a couple of screens' worth (each is about 0.5 MB). */
const KEEP = 24;
/** Chunks painted per frame while catching up, so a fast pan never stalls a frame for long. */
const PER_FRAME = 3;

const tilesOf = (cx: number, cy: number): Tiles => ({ x0: cx * CHUNK, y0: cy * CHUNK, x1: cx * CHUNK + CHUNK - 1, y1: cy * CHUNK + CHUNK - 1 });
const meets = (a: ArtRect, b: ArtRect) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

function hasWater(world: World, t: Tiles) {
  for (let y = t.y0; y <= t.y1; y++) for (let x = t.x0; x <= t.x1; x++) if (world.terrainAt(x, y) === "water") return true;
  return false;
}

export class GroundLayer {
  private world: World | null = null;
  private key = "";
  private scale = 1;
  private still = false;
  private view: ArtRect | null = null;
  /** Painted chunks, least recently shown first. */
  private readonly painted = new Map<string, Painted>();
  private shownKey = "";
  private queue: { cx: number; cy: number }[] = [];
  /** The next chunks in view are the world's first: paint the ones on screen at once. */
  private firstPaint = true;
  private raf = 0;
  private blink = 0;
  private on = false;

  constructor(private readonly host: HTMLElement) {}

  /** A new world (a stage, a district opening, a place appearing): everything is painted again. */
  setWorld(world: World, key: string) {
    this.world = world;
    if (key === this.key) return;
    this.key = key;
    for (const p of this.painted.values()) (p.base.remove(), p.shimmer?.remove());
    this.painted.clear();
    this.shownKey = "";
    this.firstPaint = true;
    this.refresh();
  }

  setScale(scale: number) {
    if (scale === this.scale) return;
    this.scale = scale;
    for (const [id, p] of this.painted) this.place(id, p);
  }

  setStill(still: boolean) {
    this.still = still;
    clearInterval(this.blink);
    this.on = false;
    this.shimmers(false);
    if (!still)
      this.blink = window.setInterval(() => {
        this.on = !this.on;
        this.shimmers(this.on);
      }, SHIMMER_MS);
  }

  /** What the camera sees, in art space. */
  show(view: ArtRect) {
    this.view = view;
    this.refresh();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    clearInterval(this.blink);
    for (const p of this.painted.values()) (p.base.remove(), p.shimmer?.remove());
    this.painted.clear();
  }

  private shimmers(visible: boolean) {
    for (const p of this.painted.values()) if (p.shimmer) p.shimmer.style.visibility = visible ? "visible" : "hidden";
  }

  private refresh() {
    const view = this.view;
    if (!this.world || !view) return;
    const wanted = chunksIn(view);
    const ids = wanted.map((c) => `${c.cx},${c.cy}`);
    const key = ids.join(";");
    // The same chunks as the last look: nothing to do (the camera moves every frame of a walk).
    if (key === this.shownKey) return;
    this.shownKey = key;
    const inView = new Set(ids);
    // Out of view: off the page, kept a while in case you walk back; the least recently shown go first.
    for (const [id, p] of this.painted) if (!inView.has(id)) (p.base.remove(), p.shimmer?.remove());
    for (const id of [...this.painted.keys()]) {
      if (this.painted.size <= KEEP) break;
      if (!inView.has(id)) this.painted.delete(id);
    }
    this.queue = [];
    for (const c of wanted) {
      const id = `${c.cx},${c.cy}`;
      const p = this.painted.get(id);
      if (!p) {
        this.queue.push(c);
        continue;
      }
      // Most recently shown last.
      this.painted.delete(id);
      this.painted.set(id, p);
      this.attach(id, p);
    }
    // Nearest the middle of the view first.
    const mid = { x: view.x + view.width / 2, y: view.y + view.height / 2 };
    const far = (c: { cx: number; cy: number }) => {
      const r = chunkRect(c.cx, c.cy);
      return Math.hypot(r.x + r.width / 2 - mid.x, r.y + r.height / 2 - mid.y);
    };
    this.queue.sort((a, b) => far(a) - far(b));
    if (this.firstPaint) {
      this.firstPaint = false;
      // The first look at a world has ground at once: the chunks on screen, before the next frame.
      const onScreen = this.queue.filter((c) => meets(chunkRect(c.cx, c.cy), view));
      this.queue = this.queue.filter((c) => !onScreen.includes(c));
      for (const c of onScreen) this.paint(c.cx, c.cy);
    }
    if (this.queue.length && !this.raf) this.raf = requestAnimationFrame(() => this.work());
  }

  private work() {
    this.raf = 0;
    for (let i = 0; i < PER_FRAME && this.queue.length; i++) {
      const c = this.queue.shift()!;
      this.paint(c.cx, c.cy);
    }
    if (this.queue.length) this.raf = requestAnimationFrame(() => this.work());
  }

  private paint(cx: number, cy: number) {
    const world = this.world!;
    const at = chunkRect(cx, cy);
    const tiles = tilesOf(cx, cy);
    const base = canvas(at);
    base.dataset.chunk = `${cx},${cy}`;
    const ctx = base.getContext("2d");
    let shimmer: HTMLCanvasElement | null = null;
    if (ctx) {
      const img = ctx.createImageData(at.width, at.height);
      paintGround(img, at, world, tiles);
      ctx.putImageData(img, 0, 0);
      // Only a chunk with water has water's other frame.
      if (hasWater(world, tiles)) {
        shimmer = canvas(at);
        const lctx = shimmer.getContext("2d")!;
        const glints = lctx.createImageData(at.width, at.height);
        paintShimmer(glints, at, world, tiles);
        lctx.putImageData(glints, 0, 0);
        shimmer.style.visibility = this.on && !this.still ? "visible" : "hidden";
      }
    }
    const id = `${cx},${cy}`;
    const p = { base, shimmer };
    this.painted.set(id, p);
    this.attach(id, p);
  }

  private attach(id: string, p: Painted) {
    this.place(id, p);
    // Back to front: a chunk further forward (a bigger cx + cy) lies over the rock of the one behind.
    const [cx, cy] = id.split(",").map(Number);
    for (const el of [p.base, p.shimmer]) {
      if (!el) continue;
      el.style.zIndex = String((cx + cy) * 2 + (el === p.shimmer ? 1 : 0) + 1000);
      if (!el.isConnected) this.host.append(el);
    }
  }

  private place(id: string, p: Painted) {
    const [cx, cy] = id.split(",").map(Number);
    const at = chunkRect(cx, cy);
    for (const el of [p.base, p.shimmer]) {
      if (!el) continue;
      el.style.left = `${at.x * this.scale}px`;
      el.style.top = `${at.y * this.scale}px`;
      el.style.width = `${at.width * this.scale}px`;
      el.style.height = `${at.height * this.scale}px`;
    }
  }
}

function canvas(at: ArtRect) {
  const el = document.createElement("canvas");
  el.width = at.width;
  el.height = at.height;
  el.className = "pixels absolute";
  el.setAttribute("aria-hidden", "true");
  return el;
}
