import clsx from "clsx";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { FPS, frameAt, frameRect, loadAtlas, type Animation, type LoadedAtlas, type Rect } from "./atlas";

/**
 * The player (#126): PostHog's Hedgehog Mode hedgehog, drawn frame by frame from its atlas onto a
 * small canvas. Until the atlas has loaded (it loads after first paint) a still placeholder stands
 * in: a lantern-lit marker, never a hedgehog of our own.
 */

/** A Hedgehog Mode frame is 80 × 80; the hedgehog stands with its feet about 8 px above the bottom. */
export const HOG_SIZE = 80;
export const HOG_FEET = 70;

/** The atlas, once loaded (null until then, and if it can't load). */
export function useAtlas(): LoadedAtlas | null {
  const [atlas, setAtlas] = useState<LoadedAtlas | null>(null);
  useEffect(() => {
    let live = true;
    loadAtlas().then(
      (a) => live && setAtlas(a),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  return atlas;
}

function context(canvas: HTMLCanvasElement | null) {
  const ctx = canvas?.getContext("2d") ?? null;
  if (ctx) ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** Where the hedgehog will stand: a pixel shade on the ground and a small lantern above it. */
function drawPlaceholder(ctx: CanvasRenderingContext2D, size: number, feet: number) {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#161226";
  ctx.fillRect(size / 2 - 12, feet - 2, 24, 4);
  ctx.fillRect(size / 2 - 8, feet - 4, 16, 8);
  ctx.fillStyle = "#3a2a22";
  ctx.fillRect(size / 2 - 4, feet - 24, 8, 10);
  ctx.fillStyle = "#f7a501";
  ctx.fillRect(size / 2 - 2, feet - 22, 4, 6);
}

function drawFrame(ctx: CanvasRenderingContext2D, loaded: LoadedAtlas, rect: Rect, crop?: Rect, over?: Rect | null) {
  const c = crop ?? { x: 0, y: 0, w: rect.w, h: rect.h };
  ctx.clearRect(0, 0, c.w, c.h);
  ctx.drawImage(loaded.image, rect.x + c.x, rect.y + c.y, c.w, c.h, 0, 0, c.w, c.h);
  // An accessory is a whole frame of its own, drawn over the hedgehog in the same place.
  if (over) ctx.drawImage(loaded.image, over.x + c.x, over.y + c.y, c.w, c.h, 0, 0, c.w, c.h);
}

/** One still frame of the hedgehog (the HUD portrait, the splash), optionally cropped. */
export function HogFrame({ animation = "idle", frame = 0, crop, scale = 1, className }: { animation?: Animation; frame?: number; crop?: Rect; scale?: number; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const loaded = useAtlas();
  const w = crop?.w ?? HOG_SIZE;
  const h = crop?.h ?? HOG_SIZE;
  useEffect(() => {
    const ctx = context(canvas.current);
    if (!ctx) return;
    const rect = loaded?.atlas.animations[animation][frame];
    if (loaded && rect) drawFrame(ctx, loaded, rect, crop);
    else drawPlaceholder(ctx, Math.min(w, h), Math.min(w, h) - 6);
  }, [loaded, animation, frame, crop, w, h]);
  return <canvas ref={canvas} width={w} height={h} aria-hidden className={clsx("pixels", className)} style={{ width: w * scale, height: h * scale }} />;
}

export type HogHandle = {
  /** Plays an animation: looping, or once and then `then` (a wave, then idle). */
  play: (animation: Animation, how?: { loop?: boolean; then?: Animation }) => void;
  /** Faces left (the atlas frames face right). */
  face: (left: boolean) => void;
};

/**
 * The hedgehog in the world, animated by its own frame clock without re-rendering React. It may
 * wear one of the atlas's accessories (the party hat on a bonus day, #134). The canvas says what it
 * is doing (`data-animation`) and wearing (`data-accessory`).
 */
export function Hog({ still, accessory, ref, className }: { still: boolean; accessory?: string; ref?: Ref<HogHandle>; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const loaded = useAtlas();
  const anim = useRef<{ name: Animation; loop: boolean; then?: Animation; start: number }>({ name: "idle", loop: true, start: 0 });
  const shown = useRef("");

  useImperativeHandle(ref, () => ({
    play: (name, how = {}) => {
      // Reduced motion: the still idle frame, whatever happened.
      if (still && name !== "idle") name = "idle";
      if (canvas.current) canvas.current.dataset.animation = name;
      // The sign says "Hello": mirrored it would read backwards, so it's held up facing right.
      if (name === "sign" && canvas.current) canvas.current.style.transform = "";
      if (anim.current.name === name && anim.current.loop && (how.loop ?? true)) return;
      anim.current = { name, loop: how.loop ?? true, then: how.then, start: performance.now() };
    },
    face: (left) => {
      if (canvas.current) canvas.current.style.transform = left ? "scaleX(-1)" : "";
    },
  }));

  useEffect(() => {
    const ctx = context(canvas.current);
    if (!ctx) return;
    if (!loaded) {
      drawPlaceholder(ctx, HOG_SIZE, HOG_FEET);
      return;
    }
    const over = accessory ? frameRect(loaded.atlas, `accessories/${accessory}.png`) : null;
    shown.current = "";
    let raf = 0;
    const tick = (now: number) => {
      const a = anim.current;
      const frames = loaded.atlas.animations[a.name];
      // Reduced motion: the first idle frame, held.
      let i = still ? 0 : frameAt(frames.length, now - a.start, FPS[a.name], a.loop);
      if (!a.loop && a.then && i === frames.length - 1 && now - a.start > (frames.length * 1000) / FPS[a.name]) {
        anim.current = { name: a.then, loop: true, start: now };
        if (canvas.current) canvas.current.dataset.animation = a.then;
        i = 0;
      }
      const key = `${anim.current.name}:${i}`;
      const rect = loaded.atlas.animations[anim.current.name][Math.max(0, i)];
      if (key !== shown.current && rect) {
        shown.current = key;
        drawFrame(ctx, loaded, rect, undefined, over);
      }
      if (!still) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loaded, still, accessory]);

  return <canvas ref={canvas} width={HOG_SIZE} height={HOG_SIZE} aria-hidden data-hog data-animation="idle" data-accessory={accessory} className={clsx("pixels block", className)} style={{ width: HOG_SIZE, height: HOG_SIZE }} />;
}
