import type { StageKey } from "../../convex/lib/garden";

/**
 * A plant in its bed, drawn from simple shapes of our own (#95): a keyboard-key bed with the plant
 * for its stage. Dormant plants turn autumn-coloured. The PostHog Keyboard garden art replaces this
 * in the art pass (#101), loaded from PostHog's servers, never committed.
 */
export function PlantArt({ stage, dormant = false, fruit = 0, size = 112 }: { stage: StageKey; dormant?: boolean; fruit?: number; size?: number }) {
  const leaf = dormant ? "#cf7d17" : "#4fca7d";
  const leafDeep = dormant ? "#9a5a14" : "#219c86";
  const trunk = "#8a5a3b";
  const canopy: Partial<Record<StageKey, { r: number; cy: number; trunkTop: number }>> = {
    young: { r: 16, cy: 44, trunkTop: 50 },
    grown: { r: 22, cy: 40, trunkTop: 48 },
    blossoming: { r: 24, cy: 38, trunkTop: 46 },
    ancient: { r: 30, cy: 36, trunkTop: 44 },
  };
  const tree = canopy[stage];
  const fruitSpots = [
    [-10, -6],
    [8, -10],
    [12, 6],
    [-6, 10],
  ].slice(0, Math.min(fruit, 4));
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-hidden className="shrink-0">
      {/* The bed: a keyboard key seen from above, with its soil. */}
      <rect x="14" y="78" width="92" height="30" rx="8" fill="#27221b" stroke="rgb(255 236 210 / 0.16)" />
      <rect x="20" y="76" width="80" height="22" rx="6" fill="#3a2d22" />
      <ellipse cx="60" cy="86" rx="30" ry="6" fill="#4a3829" />
      {stage === "seed" && <ellipse cx="60" cy="84" rx="5" ry="3.5" fill="#b0834f" />}
      {stage === "sprout" && (
        <g>
          <path d="M60 86 V74" stroke={leafDeep} strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="53" cy="72" rx="7" ry="3.5" fill={leaf} transform="rotate(-20 53 72)" />
          <ellipse cx="67" cy="72" rx="7" ry="3.5" fill={leaf} transform="rotate(20 67 72)" />
        </g>
      )}
      {stage === "sapling" && (
        <g>
          <path d="M60 86 V58" stroke={trunk} strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="51" cy="68" rx="9" ry="4" fill={leaf} transform="rotate(-25 51 68)" />
          <ellipse cx="69" cy="64" rx="9" ry="4" fill={leaf} transform="rotate(25 69 64)" />
          <ellipse cx="60" cy="55" rx="5" ry="8" fill={leafDeep} />
        </g>
      )}
      {tree && (
        <g>
          <path d={`M60 86 V${tree.trunkTop}`} stroke={trunk} strokeWidth={stage === "ancient" ? 9 : 6} strokeLinecap="round" />
          {stage === "ancient" && <path d="M60 70 L46 62 M60 66 L74 58" stroke={trunk} strokeWidth="4" strokeLinecap="round" />}
          <circle cx="60" cy={tree.cy} r={tree.r} fill={leafDeep} />
          <circle cx={60 - tree.r * 0.35} cy={tree.cy - tree.r * 0.25} r={tree.r * 0.7} fill={leaf} />
          {stage === "blossoming" &&
            !dormant &&
            [
              [-12, -4],
              [4, -14],
              [14, 2],
              [-2, 8],
              [-16, 10],
            ].map(([dx, dy], i) => <circle key={i} cx={60 + dx} cy={tree.cy + dy} r="2.6" fill="#f7a8c8" />)}
          {stage === "ancient" && !dormant && <circle cx="60" cy={tree.cy} r={tree.r + 3} fill="none" stroke="#ffb224" strokeOpacity="0.5" strokeWidth="1.5" />}
          {fruitSpots.map(([dx, dy], i) => (
            <circle key={i} data-fruit cx={60 + dx} cy={tree.cy + dy} r="4" fill="#ffb224" stroke="#cf7d17" strokeWidth="1" />
          ))}
        </g>
      )}
    </svg>
  );
}
