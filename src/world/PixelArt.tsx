import { useMemo } from "react";
import { pixelRuns, type PixelMap } from "./pixels";

/**
 * A pixel map as crisp SVG inside a window (the stone's scene, fruit, the ruins' creatures and
 * rooms): one rect per run of same-coloured pixels, scaled to its box. With a `label` it's an
 * image for screen readers; without, decoration.
 */
export function PixelArt({ map, className, label, width, height }: { map: PixelMap; className?: string; label?: string; width?: number; height?: number }) {
  const runs = useMemo(() => pixelRuns(map), [map]);
  const w = map.rows[0]?.length ?? 0;
  return (
    <svg
      viewBox={`0 0 ${w} ${map.rows.length}`}
      width={width}
      height={height}
      shapeRendering="crispEdges"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {runs.map((p) => (
        <rect key={`${p.x},${p.y}`} x={p.x} y={p.y} width={p.w} height={1} fill={p.fill} />
      ))}
    </svg>
  );
}
