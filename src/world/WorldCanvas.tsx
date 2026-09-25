import { useEffect, useRef } from "react";
import { CANVAS_H, CANVAS_W, ORIGIN, paintShimmer, paintWorld, signPoint, type WorldFurniture } from "./paint";
import type { Place } from "./places";
import { SHIMMER_MS, WORLD } from "./tiles";

/**
 * The world on one canvas (#126): ground, places, trees and beds, painted at art scale once per
 * change of what's on the map and shown at a whole-number scale. A second canvas holds only the
 * pond's other shimmer frame and blinks slowly (not under reduced motion). The canvases are
 * decoration (`aria-hidden`): the Places list is how a screen reader gets around. The place signs
 * are DOM, so their names stay crisp; they're decoration too, clickable for the mouse.
 */
export function WorldCanvas({
  places,
  furniture,
  scale,
  still,
  onPlace,
}: {
  places: Place[];
  furniture: WorldFurniture;
  scale: number;
  still: boolean;
  onPlace: (place: Place) => void;
}) {
  const base = useRef<HTMLCanvasElement>(null);
  const shimmer = useRef<HTMLCanvasElement>(null);
  const key = `${places.map((p) => p.id).join()}|${furniture.beds.map((b) => `${b.tile.x},${b.tile.y}`).join()}|${furniture.plants.join()}`;

  useEffect(() => {
    const ctx = base.current?.getContext("2d");
    const layer = shimmer.current?.getContext("2d");
    if (!ctx || !layer) return;
    const img = ctx.createImageData(CANVAS_W, CANVAS_H);
    paintWorld(img, WORLD, places, furniture);
    ctx.putImageData(img, 0, 0);
    const glints = layer.createImageData(CANVAS_W, CANVAS_H);
    paintShimmer(glints, img, WORLD);
    layer.putImageData(glints, 0, 0);
    // Painted from `key`: the arrays themselves are new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const layer = shimmer.current;
    if (!layer) return;
    layer.style.visibility = "hidden";
    if (still) return;
    let on = false;
    const timer = setInterval(() => {
      on = !on;
      layer.style.visibility = on ? "visible" : "hidden";
    }, SHIMMER_MS);
    return () => clearInterval(timer);
  }, [still]);

  const size = { width: CANVAS_W * scale, height: CANVAS_H * scale };
  return (
    <>
      <canvas ref={base} width={CANVAS_W} height={CANVAS_H} aria-hidden data-world className="pixels absolute left-0 top-0" style={size} />
      <canvas ref={shimmer} width={CANVAS_W} height={CANVAS_H} aria-hidden className="pixels absolute left-0 top-0" style={size} />
      {places.map((p) => {
        const at = signPoint(p);
        return (
          <div
            key={p.id}
            aria-hidden
            data-sign={p.id}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={() => onPlace(p)}
            className="pixel-sign absolute flex cursor-pointer items-center gap-1.5 whitespace-nowrap px-2 py-0.5 font-display text-sm font-medium leading-5"
            style={{ left: (at.x + ORIGIN.x) * scale, top: (at.y + ORIGIN.y) * scale, transform: "translate(-50%, -100%)" }}
          >
            {p.name}
            {p.badge && <span className="bg-ember px-1 font-sans text-xs font-bold text-ink">{p.badge.count > 99 ? "99+" : p.badge.count}</span>}
          </div>
        );
      })}
    </>
  );
}
