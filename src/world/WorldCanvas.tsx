import clsx from "clsx";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { GroundLayer } from "./groundLayer";
import { HOG_FEET, HOG_SIZE, HogFrame } from "./Hog";
import { tileCentre } from "./iso";
import { hogsOf, labelsOf, paintStanding, signPoints, standingRect, treeFoot, type ArtRect, type WorldFurniture } from "./paint";
import type { Place } from "./places";
import { mapHeight, mapWidth, pixelAt, type PixelMap } from "./pixels";
import { SEED_FRAMES, SEED_FRAME_MS } from "./tree/sprite";
import type { Site, World } from "./world";

/**
 * The world on screen (#126, #156): the ground in chunk canvases the camera brings in and out
 * (`GroundLayer`), everything standing round the tree on one canvas over it, the elder hog, and
 * the place signs. The canvases are decoration (`aria-hidden`): the Places list is how a screen
 * reader gets around. Signs are DOM, so names stay crisp; they're decoration too, clickable for the
 * mouse. A closed district's sign is dim and says what it will be.
 *
 * Painting happens when what stands changes, never per frame; moving the camera only asks the
 * ground layer for the chunks now in view.
 */

/**
 * The world's stacking order: the ground, what stands behind the tree, the hedgehogs behind the
 * trunk (`Z.hogBehind`), the tree, what stands in front of it, the hedgehogs in front, the names,
 * then the notes and cards that pop up over it all. Each hedgehog band is wide: within it, the
 * hedgehogs stand in depth order (`hogZ`).
 */
export const Z = { ground: 0, behind: 100, hogBehind: 1000, tree: 2000, front: 2100, hogFront: 3000, labels: 4000, notes: 4100 } as const;

/** Hedgehogs this far apart on screen (art pixels) or more simply keep their order. */
const HOG_DEPTH = 900;

/**
 * Where a hedgehog stands in the stack: in the band behind the trunk or in front of it, and within
 * it, `below` art pixels lower on screen than yours (your hedgehog is the band itself) is nearer.
 */
export function hogZ(behind: boolean, below: number): number {
  return (behind ? Z.hogBehind : Z.hogFront) + Math.max(-HOG_DEPTH, Math.min(HOG_DEPTH, Math.round(below)));
}

export type WorldCanvasHandle = {
  /** The camera's view moved: `view` in art pixels. */
  show: (view: ArtRect) => void;
};

/** Paints a pixel map onto a canvas at its own size. */
function drawMap(canvas: HTMLCanvasElement | null, m: PixelMap) {
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;
  const img = ctx.createImageData(mapWidth(m), mapHeight(m));
  for (let y = 0; y < mapHeight(m); y++)
    for (let x = 0; x < mapWidth(m); x++) {
      const c = pixelAt(m, x, y);
      if (!c) continue;
      const i = (y * mapWidth(m) + x) * 4;
      const n = parseInt(c.slice(1), 16);
      img.data.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], i);
    }
  ctx.putImageData(img, 0, 0);
}

/**
 * The seed moment (#156): six frames of the Ancient Seed sprouting where the tree will stand, once;
 * then `onDone`, and the tree's own sprite takes its place.
 */
function SeedMoment({ world, scale, onDone }: { world: World; scale: number; onDone: () => void }) {
  const [frame, setFrame] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => drawMap(canvas.current, SEED_FRAMES[frame]), [frame]);
  useEffect(() => {
    const timer = setTimeout(() => (frame + 1 < SEED_FRAMES.length ? setFrame(frame + 1) : done.current()), SEED_FRAME_MS * (frame + 1 < SEED_FRAMES.length ? 1 : 3));
    return () => clearTimeout(timer);
  }, [frame]);
  const m = SEED_FRAMES[frame];
  const foot = treeFoot(world);
  return (
    <canvas
      ref={canvas}
      data-seed-moment={frame}
      aria-hidden
      width={mapWidth(m)}
      height={mapHeight(m)}
      className="pixels pointer-events-none absolute"
      style={{ zIndex: Z.tree, left: (foot.x - mapWidth(m) / 2) * scale, top: (foot.y - mapHeight(m) + 1) * scale, width: mapWidth(m) * scale, height: mapHeight(m) * scale }}
    />
  );
}

export function WorldCanvas({
  world,
  worldKey,
  ready = true,
  places,
  furniture,
  scale,
  still,
  fresh = [],
  seedMoment = false,
  onSeedMomentDone,
  onPlace,
  onSite,
  ref,
}: {
  world: World;
  /** Names the world's ground: a new key repaints it. */
  worldKey: string;
  /** False while the tree is loading: nothing is painted yet, so no other world flashes first. */
  ready?: boolean;
  /** The places standing on your map, with their links and badges. */
  places: Place[];
  furniture: WorldFurniture;
  scale: number;
  still: boolean;
  /** Districts that opened a moment ago: they fade in, once. */
  fresh?: string[];
  seedMoment?: boolean;
  onSeedMomentDone?: () => void;
  onPlace: (place: Place) => void;
  onSite: (site: Site) => void;
  ref?: Ref<WorldCanvasHandle>;
}) {
  const groundHost = useRef<HTMLDivElement>(null);
  const layer = useRef<GroundLayer | null>(null);
  const town = useRef<HTMLCanvasElement>(null);
  const treeCanvas = useRef<HTMLCanvasElement>(null);
  const frontCanvas = useRef<HTMLCanvasElement>(null);
  const freshCanvas = useRef<HTMLCanvasElement>(null);
  const lastView = useRef<ArtRect | null>(null);

  useEffect(() => {
    const l = new GroundLayer(groundHost.current!);
    layer.current = l;
    return () => l.destroy();
  }, []);
  useEffect(() => {
    if (!ready) return;
    layer.current?.setWorld(world, worldKey);
    if (lastView.current) layer.current?.show(lastView.current);
  }, [world, worldKey, ready]);
  useEffect(() => layer.current?.setScale(scale), [scale]);
  useEffect(() => layer.current?.setStill(still), [still]);
  useImperativeHandle(ref, () => ({
    show: (view) => {
      lastView.current = view;
      layer.current?.show(view);
    },
  }));

  // Everything standing: the districts that just opened on a layer of their own, fading in.
  const freshKey = fresh.join();
  const isFresh = (p: { id: string }) => world.sites.some((s) => fresh.includes(s.id) && s.places.some((q) => q.id === p.id));
  const settled = { ...world, places: world.places.filter((p) => !isFresh(p)), sites: world.sites.map((s) => (fresh.includes(s.id) ? { ...s, open: false } : s)) };
  const opening = { ...world, trunk: null, props: [], decor: [], places: world.places.filter(isFresh), sites: world.sites.filter((s) => fresh.includes(s.id)) };
  const standKey = `${worldKey}|${furniture.key ?? furniture.plots.map((p) => p?.rows.join() ?? "").join("|")}|${furniture.beds.map((b) => `${b.tile.x},${b.tile.y}:${b.sprite?.rows.join() ?? ""}`).join()}|${freshKey}|${seedMoment}`;
  const rect = standingRect(world, furniture);
  useEffect(() => {
    if (!ready) return;
    // Behind the trunk, the tree, in front of it (the hedgehog goes between as it walks), and what just opened.
    for (const [canvas, what, layer] of [
      [town.current, settled, "behind"],
      [treeCanvas.current, settled, seedMoment ? null : "tree"],
      [frontCanvas.current, settled, "front"],
      [freshCanvas.current, opening, "all"],
    ] as const) {
      // The terrace's plants belong to the layer the terrace is on.
      const plants = what === settled ? (fresh.includes("terrace") ? { beds: [], plots: [] } : furniture) : fresh.includes("terrace") ? furniture : { beds: [], plots: [] };
      const ctx = canvas?.getContext("2d");
      if (!ctx) continue;
      const img = ctx.createImageData(rect.width, rect.height);
      if (layer) paintStanding(img, rect, what as World, plants, layer);
      ctx.putImageData(img, 0, 0);
    }
    // Painted from `standKey`: the objects themselves are new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standKey, ready, rect.x, rect.y, rect.width, rect.height]);

  // Every name over the world, kept clear of the doors and of each other.
  const labels = ready ? labelsOf(world) : [];
  const signs = signPoints(places, labels, ready ? hogsOf(world) : []);
  const box = { left: rect.x * scale, top: rect.y * scale, width: rect.width * scale, height: rect.height * scale };
  const elder = world.props.find((p) => p.kind === "elder");
  const elderAt = elder && tileCentre(elder.tile);
  return (
    <>
      <div ref={groundHost} aria-hidden data-ground className="absolute left-0 top-0 isolate" style={{ zIndex: Z.ground }} />
      <canvas ref={town} width={rect.width} height={rect.height} aria-hidden data-world className="pixels absolute" style={{ ...box, zIndex: Z.behind }} />
      <canvas ref={treeCanvas} width={rect.width} height={rect.height} aria-hidden data-tree className="pixels absolute" style={{ ...box, zIndex: Z.tree }} />
      <canvas ref={frontCanvas} width={rect.width} height={rect.height} aria-hidden data-front className="pixels absolute" style={{ ...box, zIndex: Z.front }} />
      <canvas
        // A new opening is a new canvas, so it fades in even right after another.
        key={freshKey}
        ref={freshCanvas}
        width={rect.width}
        height={rect.height}
        aria-hidden
        data-fresh={freshKey || undefined}
        className={clsx("pixels absolute", freshKey && !still && "animate-[district-open_900ms_ease-out_both]")}
        style={{ ...box, zIndex: Z.front }}
      />
      {seedMoment && <SeedMoment world={world} scale={scale} onDone={() => onSeedMomentDone?.()} />}
      {elderAt && (
        <>
          {/* PostHog's hedgehog, silvered with age: a placeholder until the tutorial lane (#159) gives the elder its words. */}

          <div aria-hidden data-elder className="pointer-events-none absolute" style={{ zIndex: Z.front, left: elderAt.x * scale - HOG_SIZE / 2, top: (elderAt.y + 4) * scale - HOG_FEET }}>
            <HogFrame className="-scale-x-100 [filter:grayscale(0.85)_brightness(1.15)]" />
          </div>

        </>
      )}
      {places.map((p) => {
        const at = signs.get(p.id)!;
        return (
          <div
            key={p.id}
            aria-hidden
            data-sign={p.id}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={() => onPlace(p)}
            className="pixel-sign absolute flex cursor-pointer items-center gap-1.5 whitespace-nowrap px-2 py-0.5 font-display text-sm font-medium leading-5"
            style={{ zIndex: Z.labels, left: at.x * scale, top: at.y * scale, transform: "translate(-50%, -100%)" }}
          >
            {p.name}
            {p.badge && <span className="bg-ember px-1 font-sans text-xs font-bold text-ink">{p.badge.count > 99 ? "99+" : p.badge.count}</span>}
          </div>
        );
      })}
      {labels.map((l) => {
        const at = signs.get(l.id);
        if (!at) return null;
        // A closed district's sign walks you up to its outline; the others are names only.
        const closed = l.id.startsWith("closed:") ? world.sites.find((s) => `closed:${s.id}` === l.id) : undefined;
        return (
          <div
            key={l.id}
            aria-hidden
            data-label={l.id}
            data-closed-sign={closed?.id}
            onPointerDown={closed && ((e) => e.stopPropagation())}
            onPointerUp={closed && ((e) => e.stopPropagation())}
            onClick={closed && (() => onSite(closed))}
            className={clsx(
              "pixel-sign absolute whitespace-nowrap px-2 py-0.5 font-display text-xs font-medium leading-4",
              closed ? "cursor-pointer opacity-60" : "pointer-events-none",
            )}
            style={{ zIndex: Z.labels, left: at.x * scale, top: at.y * scale, transform: "translate(-50%, -100%)" }}
          >
            {l.name}
          </div>
        );
      })}
    </>
  );
}
