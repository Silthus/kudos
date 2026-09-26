import { CHUNK } from "./desert";
import { chunkRect, chunksIn, paintGround, paintShimmer, type ArtRect } from "./paint";
import { SHIMMER_MS } from "./tiles";
import type { World } from "./world";

/**
 * The ground on screen (#156): one canvas per 32 × 32 chunk, added as the camera comes near and
 * dropped as it leaves, painted a few at a time off React's render path. The camera calls `show`
 * with what it sees; nothing re-renders. A chunk with water gets a second canvas for the water's
 * other frame, and all of those blink together, slowly (not under reduced motion).
 */

type Painted = { base: HTMLCanvasElement; shimmer: HTMLCanvasElement | null };

/** Chunks painted and kept for a walk back: about four screens' worth. */
const KEEP = 48;
/** Chunks painted per frame while catching up, so a fast pan never stalls a frame for long. */
const PER_FRAME = 3;

export class GroundLayer {
  private world: World | null = null;
  private key = "";
  private scale = 1;
  private still = false;
  private view: ArtRect | null = null;
  private readonly painted = new Map<string, Painted>();
  private queue: { cx: number; cy: number }[] = [];
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

  /** How many chunk canvases are in the page (for tests). */
  get count() {
    return this.host.querySelectorAll("canvas[data-chunk]").length;
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
    if (!this.world || !this.view) return;
    const wanted = chunksIn(this.view);
    const ids = new Set(wanted.map((c) => `${c.cx},${c.cy}`));
    // Out of view: off the page, kept for a while in case you walk back.
    for (const [id, p] of this.painted) {
      if (ids.has(id)) continue;
      p.base.remove();
      p.shimmer?.remove();
    }
    while (this.painted.size > KEEP) {
      const oldest = [...this.painted.keys()].find((id) => !ids.has(id));
      if (!oldest) break;
      this.painted.delete(oldest);
    }
    this.queue = [];
    for (const c of wanted) {
      const id = `${c.cx},${c.cy}`;
      const p = this.painted.get(id);
      if (p) this.attach(id, p);
      else this.queue.push(c);
    }
    // Nearest the middle of the view first.
    const mid = { x: this.view.x + this.view.width / 2, y: this.view.y + this.view.height / 2 };
    const far = (c: { cx: number; cy: number }) => {
      const r = chunkRect(c.cx, c.cy);
      return Math.hypot(r.x + r.width / 2 - mid.x, r.y + r.height / 2 - mid.y);
    };
    this.queue.sort((a, b) => far(a) - far(b));
    // What's on screen now is painted at once, so the first paint has ground; the margin follows.
    this.work(Infinity, true);
  }

  private work(budget: number, onScreenOnly = false) {
    cancelAnimationFrame(this.raf);
    const view = this.view!;
    let done = 0;
    while (this.queue.length && done < budget) {
      const c = this.queue[0];
      const r = chunkRect(c.cx, c.cy);
      const visible = r.x < view.x + view.width && r.x + r.width > view.x && r.y < view.y + view.height && r.y + r.height > view.y;
      if (onScreenOnly && !visible) break;
      this.queue.shift();
      this.paint(c.cx, c.cy);
      done++;
    }
    if (this.queue.length) this.raf = requestAnimationFrame(() => this.work(PER_FRAME));
  }

  private paint(cx: number, cy: number) {
    const world = this.world!;
    const at = chunkRect(cx, cy);
    const tiles = { x0: cx * CHUNK, y0: cy * CHUNK, x1: cx * CHUNK + CHUNK - 1, y1: cy * CHUNK + CHUNK - 1 };
    const base = canvas(at, cx, cy);
    const ctx = base.getContext("2d");
    let shimmer: HTMLCanvasElement | null = null;
    if (ctx) {
      const img = ctx.createImageData(at.width, at.height);
      paintGround(img, at, world, tiles);
      ctx.putImageData(img, 0, 0);
      const layer = canvas(at, cx, cy);
      const lctx = layer.getContext("2d")!;
      const glints = lctx.createImageData(at.width, at.height);
      if (paintShimmer(glints, at, world, tiles)) {
        lctx.putImageData(glints, 0, 0);
        layer.removeAttribute("data-chunk");
        layer.style.visibility = this.on && !this.still ? "visible" : "hidden";
        shimmer = layer;
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
    const depth = cx + cy;
    for (const el of [p.base, p.shimmer]) {
      if (!el) continue;
      el.style.zIndex = String(depth * 2 + (el === p.shimmer ? 1 : 0) + 1000);
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

function canvas(at: ArtRect, cx: number, cy: number) {
  const el = document.createElement("canvas");
  el.width = at.width;
  el.height = at.height;
  el.className = "pixels absolute";
  el.setAttribute("aria-hidden", "true");
  el.dataset.chunk = `${cx},${cy}`;
  return el;
}
