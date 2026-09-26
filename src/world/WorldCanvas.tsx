import clsx from "clsx";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { TREE_STAGES, stageIndex } from "../../convex/lib/tree";
import { GroundLayer } from "./groundLayer";
import { HOG_FEET, HOG_SIZE, HogFrame } from "./Hog";
import { tileCentre } from "./iso";
import { paintStanding, signPoints, standingRect, treeFoot, type ArtRect, type WorldFurniture } from "./paint";
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
      style={{ left: (foot.x - mapWidth(m) / 2) * scale, top: (foot.y - mapHeight(m) + 1) * scale, width: mapWidth(m) * scale, height: mapHeight(m) * scale }}
    />
  );
}

/** The middle of a closed district's outline, for its dim sign. */
function outlineTop(s: Site) {
  const back = tileCentre({ x: s.outline.x0, y: s.outline.y0 });
  const front = tileCentre({ x: s.outline.x1, y: s.outline.y1 });
  return { x: (back.x + front.x) / 2, y: (back.y + front.y) / 2 - 6 };
}

export function WorldCanvas({
  world,
  worldKey,
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
  const freshCanvas = useRef<HTMLCanvasElement>(null);
  const lastView = useRef<ArtRect | null>(null);

  useEffect(() => {
    const l = new GroundLayer(groundHost.current!);
    layer.current = l;
    return () => l.destroy();
  }, []);
  useEffect(() => {
    layer.current?.setWorld(world, worldKey);
    if (lastView.current) layer.current?.show(lastView.current);
  }, [world, worldKey]);
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
    for (const [canvas, what, extra] of [
      [town.current, settled, { tree: !seedMoment }],
      [freshCanvas.current, opening, { tree: false }],
    ] as const) {
      // The terrace's plants belong to the layer the terrace is on.
      const plants = what === settled ? (fresh.includes("terrace") ? { beds: [], plots: [] } : furniture) : fresh.includes("terrace") ? furniture : { beds: [], plots: [] };
      const ctx = canvas?.getContext("2d");
      if (!ctx) continue;
      const img = ctx.createImageData(rect.width, rect.height);
      paintStanding(img, rect, what as World, plants, extra);
      ctx.putImageData(img, 0, 0);
    }
    // Painted from `standKey`: the objects themselves are new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standKey, rect.x, rect.y, rect.width, rect.height]);

  // Closed districts are dry outlines; the ones the tree's next stage opens carry a dim sign, the rest wait unnamed.
  const next = TREE_STAGES[stageIndex(world.stage) + 1]?.id;
  const coming = world.planted ? world.sites.filter((s) => !s.open && s.opens === next) : [];
  const signs = signPoints(places, coming.map((s) => ({ id: `closed:${s.id}`, name: s.name, at: outlineTop(s) })));
  const box = { left: rect.x * scale, top: rect.y * scale, width: rect.width * scale, height: rect.height * scale };
  const elder = world.props.find((p) => p.kind === "elder");
  const elderAt = elder && tileCentre(elder.tile);
  return (
    <>
      <div ref={groundHost} aria-hidden data-ground className="absolute left-0 top-0 isolate" />
      <canvas ref={town} width={rect.width} height={rect.height} aria-hidden data-world className="pixels absolute" style={box} />
      <canvas
        ref={freshCanvas}
        width={rect.width}
        height={rect.height}
        aria-hidden
        data-fresh={freshKey || undefined}
        className={clsx("pixels absolute", freshKey && !still && "animate-[district-open_900ms_ease-out_both]")}
        style={box}
      />
      {seedMoment && <SeedMoment world={world} scale={scale} onDone={() => onSeedMomentDone?.()} />}
      {elderAt && (
        <>
          {/* PostHog's hedgehog, silvered with age: a placeholder until the tutorial lane (#159) gives the elder its words. */}
          <div aria-hidden data-elder className="pointer-events-none absolute" style={{ left: elderAt.x * scale - HOG_SIZE / 2, top: (elderAt.y + 4) * scale - HOG_FEET }}>
            <HogFrame className="-scale-x-100 [filter:grayscale(0.85)_brightness(1.15)]" />
          </div>
          <div
            aria-hidden
            className="pixel-sign pointer-events-none absolute whitespace-nowrap px-2 py-0.5 font-display text-xs font-medium leading-4"
            style={{ left: elderAt.x * scale, top: (elderAt.y + 4) * scale - HOG_FEET + 6, transform: "translate(-50%, -100%)" }}
          >
            The elder hog
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
            style={{ left: at.x * scale, top: at.y * scale, transform: "translate(-50%, -100%)" }}
          >
            {p.name}
            {p.badge && <span className="bg-ember px-1 font-sans text-xs font-bold text-ink">{p.badge.count > 99 ? "99+" : p.badge.count}</span>}
          </div>
        );
      })}
      {world.sites
        .filter((s) => s.open && !s.places.length && s.id !== "base_camp")
        .map((s) => {
          const at = tileCentre(s.at);
          return (
            <div
              key={s.id}
              aria-hidden
              data-district-sign={s.id}
              className="pixel-sign pointer-events-none absolute whitespace-nowrap px-2 py-0.5 font-display text-xs font-medium leading-4"
              style={{ left: at.x * scale, top: (at.y - 22) * scale, transform: "translate(-50%, -100%)" }}
            >
              {s.name}
            </div>
          );
        })}
      {coming.map((s) => {
          const at = signs.get(`closed:${s.id}`)!;
          return (
            <div
              key={s.id}
              aria-hidden
              data-closed-sign={s.id}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => onSite(s)}
              className="pixel-sign absolute cursor-pointer whitespace-nowrap px-2 py-0.5 font-display text-xs font-medium leading-4 opacity-60"
              style={{ left: at.x * scale, top: at.y * scale, transform: "translate(-50%, -100%)" }}
            >
              {s.name}
            </div>
          );
        })}
    </>
  );
}
