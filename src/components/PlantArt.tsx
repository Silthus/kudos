import type { ReactNode } from "react";
import type { SpeciesId, StageKey } from "../../convex/lib/garden";

/**
 * A plant in its bed, in the look of posthog.com's Keyboard garden (#101, #55 §G8): an isometric
 * keyboard key, hedge-green with soil on top, and the plant for its stage and species growing from
 * it. Dormant plants (and their key) turn autumn-coloured and stop blossoming; golden leaves from
 * Super kudos (#98) hang on the plant. Our own drawing from simple shapes: the Keyboard garden's
 * hedgehogs themselves are PostHog's art and load from PostHog's servers (`lib/art.ts`).
 */

type Canopy = "round" | "cone" | "flower" | "fronds" | "weeping";
type Look = { canopy: Canopy; leaf: string; deep: string; trunk?: string; blossom?: string };

const LOOKS: Record<SpeciesId, Look> = {
  helpful_oak: { canopy: "round", leaf: "#4fca7d", deep: "#219c86" },
  kind_maple: { canopy: "round", leaf: "#e0663a", deep: "#a8402a" },
  steady_birch: { canopy: "round", leaf: "#a3d977", deep: "#5fa640", trunk: "#e8e2d4" },
  generous_cherry: { canopy: "round", leaf: "#2e8a55", deep: "#1c5c38", trunk: "#6b2f2a", blossom: "#f7a8c8" },
  wise_ginkgo: { canopy: "round", leaf: "#e9d449", deep: "#b7a22d" },
  patient_pine: { canopy: "cone", leaf: "#2f8f5b", deep: "#1f6b44" },
  brave_cedar: { canopy: "cone", leaf: "#5f8f8a", deep: "#3b615d", trunk: "#6e4a32" },
  bright_sunflower: { canopy: "flower", leaf: "#f7c325", deep: "#3f8f4f" },
  curious_fern: { canopy: "fronds", leaf: "#58b368", deep: "#2f7d45" },
  golden_willow: { canopy: "weeping", leaf: "#c9d65a", deep: "#8f9c32" },
};

const AUTUMN = { leaf: "#cf7d17", deep: "#9a5a14" };
const INK = "#1d1f27";
const BASE = 86; // where the plant meets the soil

/** How tall each stage stands above its bed, in viewBox units: always a step up from the last. */
const HEIGHT: Record<StageKey, number> = { seed: 4, sprout: 14, sapling: 26, young: 38, grown: 48, blossoming: 52, ancient: 60 };
/** The crown's radius once it's a tree. */
const CROWN: Partial<Record<StageKey, number>> = { young: 13, grown: 17, blossoming: 19, ancient: 23 };
/** Where blossoms and fruit sit on a crown, as fractions of its radius. */
const SPOTS = [
  [-0.5, -0.1],
  [0.35, -0.45],
  [0.55, 0.25],
  [-0.2, 0.45],
  [-0.65, 0.4],
] as const;

/** The bed: a keyboard key seen from above, hedge on its sides, soil on its top. */
function KeyBed({ dormant }: { dormant: boolean }) {
  const [rim, left, right] = dormant ? ["#b58a3a", "#9a6a2a", "#7a5020"] : ["#7aa845", "#55803a", "#3f662b"];
  return (
    <g data-bed="key" stroke={INK} strokeOpacity="0.55" strokeLinejoin="round" strokeWidth="1.2">
      <path d="M18 86 L60 101 L60 114 L18 99 Z" fill={left} />
      <path d="M60 101 L102 86 L102 99 L60 114 Z" fill={right} />
      <path d="M60 70 L102 86 L60 101 L18 86 Z" fill={rim} />
      <path d="M60 74 L92 86 L60 97 L28 86 Z" fill="#5a3b2a" strokeOpacity="0.35" />
      <path d="M40 86 L60 79 M48 90 L70 82 M56 93 L80 85" stroke="#3d271b" strokeOpacity="0.8" strokeWidth="1" />
      {/* Hedge speckles on the key's sides. */}
      <path d="M26 93 l3 -1 M36 97 l3 -1 M46 101 l3 -1 M72 102 l3 1 M84 98 l3 1 M94 94 l3 1" stroke={INK} strokeOpacity="0.35" strokeWidth="1" />
    </g>
  );
}

function GoldenLeaf({ x, y, rotate }: { x: number; y: number; rotate: number }) {
  return (
    <g data-golden-leaf transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <path d="M0 0 C3 -5 9 -5 12 0 C9 5 3 5 0 0 Z" fill="#f7c325" stroke="#b7791f" strokeWidth="1" />
      <path d="M1 0 H10" stroke="#b7791f" strokeWidth="0.8" />
    </g>
  );
}

/** Seed, sprout and sapling: the same for every species but for their colour. */
function Young({ stage, top, leaf, deep, trunk }: { stage: "seed" | "sprout" | "sapling"; top: number; leaf: string; deep: string; trunk: string }) {
  if (stage === "seed") {
    return (
      <g>
        <ellipse cx="60" cy={BASE - 1} rx="9" ry="3.5" fill="#6b4a35" />
        <ellipse data-leaf cx="60" cy={BASE - 3} rx="4" ry="2.8" fill="#b0834f" stroke={INK} strokeOpacity="0.5" />
      </g>
    );
  }
  if (stage === "sprout") {
    return (
      <g>
        <path d={`M60 ${BASE} V${top + 4}`} stroke={deep} strokeWidth="2.5" strokeLinecap="round" />
        <ellipse data-leaf cx="53" cy={top + 4} rx="7" ry="3.5" fill={leaf} stroke={INK} strokeOpacity="0.4" transform={`rotate(-20 53 ${top + 4})`} />
        <ellipse cx="67" cy={top + 4} rx="7" ry="3.5" fill={leaf} stroke={INK} strokeOpacity="0.4" transform={`rotate(20 67 ${top + 4})`} />
      </g>
    );
  }
  return (
    <g>
      <path d={`M60 ${BASE} V${top + 2}`} stroke={trunk} strokeWidth="3" strokeLinecap="round" />
      <ellipse data-leaf cx="51" cy={top + 12} rx="9" ry="4" fill={leaf} stroke={INK} strokeOpacity="0.4" transform={`rotate(-25 51 ${top + 12})`} />
      <ellipse cx="69" cy={top + 8} rx="9" ry="4" fill={leaf} stroke={INK} strokeOpacity="0.4" transform={`rotate(25 69 ${top + 8})`} />
      <ellipse cx="60" cy={top + 4} rx="5" ry="7" fill={deep} stroke={INK} strokeOpacity="0.4" />
    </g>
  );
}

/** A young-or-older plant's crown, in its species' shape. */
function Crown({ canopy, top, cy, r, leaf, deep, dormant }: { canopy: Canopy; top: number; cy: number; r: number; leaf: string; deep: string; dormant: boolean }) {
  switch (canopy) {
    case "cone":
      return (
        <g stroke={INK} strokeOpacity="0.45" strokeLinejoin="round">
          <path d={`M60 ${top} L${60 + r} ${cy + r * 0.9} H${60 - r} Z`} fill={deep} />
          <path data-leaf d={`M60 ${top + r * 0.2} L${60 + r * 0.72} ${cy + r * 0.3} H${60 - r * 0.72} Z`} fill={leaf} />
        </g>
      );
    case "flower":
      return (
        <g stroke={INK} strokeOpacity="0.45">
          <ellipse cx="50" cy={cy + r * 0.9} rx="8" ry="3.5" fill={deep} transform={`rotate(-25 50 ${cy + r * 0.9})`} />
          <ellipse cx="70" cy={cy + r * 1.1} rx="8" ry="3.5" fill={deep} transform={`rotate(25 70 ${cy + r * 1.1})`} />
          <circle data-leaf cx="60" cy={cy} r={r * 0.75} fill={leaf} />
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            const [x, y] = [60 + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7];
            return <ellipse key={i} cx={x} cy={y} rx={r * 0.28} ry={r * 0.14} fill={leaf} transform={`rotate(${(a * 180) / Math.PI} ${x} ${y})`} />;
          })}
          <circle cx="60" cy={cy} r={r * 0.38} fill={dormant ? "#5a3b20" : "#6b3f1d"} />
        </g>
      );
    case "fronds": {
      // Fronds rise from the soil to the plant's full height, so a fern grows like any tree.
      const h = BASE - top;
      return (
        <g stroke={INK} strokeOpacity="0.4">
          {[-60, 60, -30, 30, 0].map((deg, i) => (
            <ellipse key={deg} data-leaf={deg === 0 ? "" : undefined} cx="60" cy={BASE - h / 2} rx={Math.max(r * 0.32, h * 0.12)} ry={h / 2} fill={i < 2 ? deep : leaf} transform={`rotate(${deg} 60 ${BASE - 2})`} />
          ))}
        </g>
      );
    }
    case "weeping":
      return (
        <g stroke={INK} strokeOpacity="0.4">
          <ellipse cx="60" cy={cy} rx={r} ry={r * 0.7} fill={deep} />
          <ellipse data-leaf cx="58" cy={cy - r * 0.15} rx={r * 0.75} ry={r * 0.5} fill={leaf} />
          {[-0.8, -0.45, -0.1, 0.25, 0.6, 0.9].map((f) => (
            <path key={f} d={`M${60 + f * r} ${cy} q ${f * 3} ${r * 0.7} ${f * 2} ${r * 1.2}`} stroke={leaf} strokeOpacity="1" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          ))}
        </g>
      );
    default:
      return (
        <g stroke={INK} strokeOpacity="0.45">
          <circle cx="60" cy={cy} r={r} fill={deep} />
          <circle data-leaf cx={60 - r * 0.3} cy={cy - r * 0.25} r={r * 0.68} fill={leaf} />
        </g>
      );
  }
}

export function PlantArt({
  stage,
  species = "helpful_oak",
  dormant = false,
  fruit = 0,
  goldenLeaves = 0,
  size = 112,
}: {
  stage: StageKey;
  species?: string;
  dormant?: boolean;
  fruit?: number;
  goldenLeaves?: number;
  size?: number;
}) {
  const look = Object.hasOwn(LOOKS, species) ? LOOKS[species as SpeciesId] : LOOKS.helpful_oak;
  const leaf = dormant ? AUTUMN.leaf : look.leaf;
  const deep = dormant ? AUTUMN.deep : look.deep;
  const trunk = look.trunk ?? "#8a5a3b";
  const height = HEIGHT[stage];
  const top = BASE - height;
  const r = CROWN[stage];
  const cy = r !== undefined ? top + r : top; // the crown's centre

  let plant: ReactNode;
  if (stage === "seed" || stage === "sprout" || stage === "sapling") {
    plant = <Young stage={stage} top={top} leaf={leaf} deep={deep} trunk={trunk} />;
  } else {
    const R = r!;
    const shape = look.canopy;
    const flower = shape === "flower";
    plant = (
      <g data-canopy={shape}>
        <path d={`M60 ${BASE} V${cy}`} stroke={flower ? deep : trunk} strokeWidth={flower ? 3 : stage === "ancient" ? 8 : 5} strokeLinecap="round" />
        {stage === "ancient" && !flower && shape !== "fronds" && (
          <path d={`M60 ${BASE - 14} L46 ${BASE - 22} M60 ${BASE - 18} L74 ${BASE - 26}`} stroke={trunk} strokeWidth="3.5" strokeLinecap="round" />
        )}
        <Crown canopy={shape} top={top} cy={cy} r={R} leaf={leaf} deep={deep} dormant={dormant} />
        {stage === "blossoming" &&
          !dormant &&
          (flower
            ? [-16, 16].map((dx) => <circle key={dx} data-blossom cx={60 + dx} cy={cy + R + 2} r="4.5" fill="#f7c325" stroke="#6b3f1d" strokeWidth="2" />)
            : SPOTS.map(([dx, dy], i) => <circle key={i} data-blossom cx={60 + dx * R} cy={cy + dy * R} r="2.6" fill={look.blossom ?? "#fff1f5"} stroke={INK} strokeOpacity="0.3" />))}
        {stage === "ancient" && !dormant && <circle cx="60" cy={cy} r={R + 4} fill="none" stroke="#ffb224" strokeOpacity="0.5" strokeWidth="1.5" />}
        {SPOTS.slice(0, Math.min(fruit, 4)).map(([dx, dy], i) => (
          <circle key={i} data-fruit cx={60 + dx * R * 0.9} cy={cy + dy * R * 0.9 + 3} r="4" fill="#ffb224" stroke="#cf7d17" strokeWidth="1" />
        ))}
      </g>
    );
  }

  // Golden leaves hang on the crown once there is one, else they lie by the plant on its bed.
  const leafSpots: [number, number, number][] =
    r !== undefined
      ? [
          [60 - r - 4, cy + 2, -30],
          [60 + r - 6, cy - 4, 20],
          [56, top - 2, -80],
        ]
      : [
          [38, 84, -10],
          [72, 82, 15],
          [52, 92, 5],
        ];

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-hidden className="shrink-0" data-stage={stage} data-species={species} data-dormant={dormant ? "true" : "false"}>
      <KeyBed dormant={dormant} />
      <g data-growth data-height={height}>
        {plant}
      </g>
      {leafSpots.slice(0, Math.min(goldenLeaves, 3)).map(([x, y, rot], i) => (
        <GoldenLeaf key={i} x={x} y={y} rotate={rot} />
      ))}
    </svg>
  );
}
