import { useMemo } from "react";
import { pixelRuns, type PixelMap } from "./pixels";

/** A pixel map as crisp SVG, scaled to fit its box: one rect per run, however big it's drawn. */
export function PixelArt({ map, className, label }: { map: PixelMap; className?: string; label?: string }) {
  const runs = useMemo(() => pixelRuns(map), [map]);
  const w = map.rows[0]?.length ?? 0;
  return (
    <svg viewBox={`0 0 ${w} ${map.rows.length}`} shapeRendering="crispEdges" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {runs.map((p) => (
        <rect key={`${p.x},${p.y}`} x={p.x} y={p.y} width={p.w} height={1} fill={p.fill} />
      ))}
    </svg>
  );
}
