import { useId, type CSSProperties, type ReactNode } from "react";
import type { Rarity } from "../../crates/drops";
import "./lootCrate.css";

export type LootPhase = "closed" | "charging" | "burst" | "reveal";

type LootCrateProps = { phase: LootPhase; rarity: Rarity; width: number; idle?: boolean; children?: ReactNode };

const sparkTones = ["#ffffff", "var(--band-lemon)", "var(--loot-glow)"];

const sparks = Array.from({ length: 18 }, (_, at) => {
  const angle = (at / 18) * Math.PI * 2 + (at % 2) * 0.17;
  const reach = 120 + (at % 3) * 42;
  return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach * 0.8 - 50, delay: 0.03 * (at % 5), tone: sparkTones[at % 3]!, size: 9 + (at % 3) * 5 };
});

const confettiTones = ["var(--band-lemon)", "var(--band-tangerine)", "var(--band-blue)", "#ffffff", "var(--loot-glow)"];

const confetti = Array.from({ length: 30 }, (_, at) => {
  const angle = -Math.PI * (0.15 + (at / 30) * 0.7);
  const reach = 150 + ((at * 37) % 90);
  return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach + 120, rotate: 180 + ((at * 53) % 360), delay: 0.1 + 0.02 * (at % 9), tone: confettiTones[at % 5]! };
});

export function LootCrate({ phase, rarity, width, idle = false, children }: LootCrateProps) {
  const scale = width / 240;
  const showers = rarity === "legendary" || rarity === "epic";
  return (
    <span className="loot" data-phase={phase} data-rarity={rarity} data-idle={idle || undefined} style={{ width, "--loot-glow": `var(--rarity-${rarity})` } as CSSProperties}>
      <span className="loot-rays" aria-hidden="true" />
      <span className="loot-rays-2" aria-hidden="true" />
      <span className="loot-beam" aria-hidden="true" />
      <span className="loot-plinth" aria-hidden="true" />
      <span className="loot-flash" aria-hidden="true" />
      <span className="loot-ring" aria-hidden="true" />
      <CrateBack />
      <span className="loot-hog" aria-hidden={phase === "closed" || phase === "charging"}>
        {children}
      </span>
      <CrateFront />
      <span className="loot-seam" aria-hidden="true" />
      <CrateLid />
      {sparks.map((spark, at) => (
        <svg key={at} viewBox="0 0 16 16" className="loot-spark" aria-hidden="true" style={{ "--x": `${spark.x * scale}px`, "--y": `${spark.y * scale}px`, "--d": `${spark.delay}s`, width: spark.size, height: spark.size, color: spark.tone } as CSSProperties}>
          <path d="M8 0 9.8 6.2 16 8 9.8 9.8 8 16 6.2 9.8 0 8 6.2 6.2Z" fill="currentColor" />
        </svg>
      ))}
      {showers && confetti.map((piece, at) => <span key={at} className="loot-confetti" aria-hidden="true" style={{ "--x": `${piece.x * scale}px`, "--y": `${piece.y * scale}px`, "--r": `${piece.rotate}deg`, "--d": `${piece.delay}s`, "--tone": piece.tone } as CSSProperties} />)}
    </span>
  );
}

const ink = "#141414";

function CrateBack() {
  const glow = useId();
  return (
    <svg viewBox="0 0 240 220" className="loot-layer loot-back" aria-hidden="true">
      <defs>
        <radialGradient id={glow} cx="50%" cy="100%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" className="loot-glow-fill" stopOpacity="0.9" />
          <stop offset="100%" className="loot-glow-fill" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="120" cy="210" rx="104" ry="9" fill={ink} opacity="0.3" />
      <ellipse cx="120" cy="110" rx="116" ry="66" fill={`url(#${glow})`} opacity="0.9" />
      <rect x="32" y="100" width="176" height="24" rx="8" fill={ink} />
    </svg>
  );
}

function CrateFront() {
  const body = useId();
  const strap = useId();
  const plate = useId();
  const sheen = useId();
  return (
    <svg viewBox="0 0 240 220" className="loot-layer loot-front" aria-hidden="true">
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff7b3f" />
          <stop offset="55%" stopColor="#ff5c1c" />
          <stop offset="100%" stopColor="#c23a08" />
        </linearGradient>
        <linearGradient id={strap} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffe36a" />
          <stop offset="50%" stopColor="#ffce1c" />
          <stop offset="100%" stopColor="#d9a400" />
        </linearGradient>
        <linearGradient id={plate} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe36a" />
          <stop offset="100%" stopColor="#e3ad00" />
        </linearGradient>
        <linearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="38" y="200" width="34" height="12" rx="4" fill={ink} />
      <rect x="168" y="200" width="34" height="12" rx="4" fill={ink} />
      <rect x="22" y="108" width="196" height="96" rx="14" fill={`url(#${body})`} stroke={ink} strokeWidth="5" />
      <path d="M28 140h184M28 172h184" stroke={ink} strokeOpacity="0.28" strokeWidth="4" />
      <rect x="22" y="108" width="196" height="96" rx="14" fill={`url(#${sheen})`} />
      <path d="M36 122c0-4 3-7 7-7h36" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />
      <rect x="42" y="108" width="22" height="96" fill={`url(#${strap})`} stroke={ink} strokeWidth="4" />
      <rect x="176" y="108" width="22" height="96" fill={`url(#${strap})`} stroke={ink} strokeWidth="4" />
      <circle cx="53" cy="124" r="3.5" fill={ink} />
      <circle cx="53" cy="188" r="3.5" fill={ink} />
      <circle cx="187" cy="124" r="3.5" fill={ink} />
      <circle cx="187" cy="188" r="3.5" fill={ink} />
      <rect x="94" y="112" width="52" height="56" rx="11" fill={`url(#${plate})`} stroke={ink} strokeWidth="5" />
      <path d="M120 120 134 134 120 150 106 134Z" className="loot-gem" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
      <path d="M114 128 120 122" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
      <circle cx="120" cy="158" r="3.5" fill={ink} />
      <rect x="22" y="108" width="196" height="96" rx="14" fill="none" stroke={ink} strokeWidth="5" />
    </svg>
  );
}

function CrateLid() {
  const lid = useId();
  const band = useId();
  return (
    <svg viewBox="0 0 240 220" className="loot-layer loot-lid" aria-hidden="true">
      <defs>
        <linearGradient id={lid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff9a66" />
          <stop offset="60%" stopColor="#ff5c1c" />
          <stop offset="100%" stopColor="#e04a10" />
        </linearGradient>
        <linearGradient id={band} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#d9a400" />
          <stop offset="50%" stopColor="#ffe36a" />
          <stop offset="100%" stopColor="#d9a400" />
        </linearGradient>
      </defs>
      <path d="M16 112V80c0-26 20-44 46-44h116c26 0 46 18 46 44v32Z" fill={`url(#${lid})`} stroke={ink} strokeWidth="5" strokeLinejoin="round" />
      <path d="M34 72c4-14 16-24 32-24h58" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" />
      <path d="M16 94h208" stroke={ink} strokeOpacity="0.28" strokeWidth="4" />
      <path d="M42 112V56c0-7 5-13 12-15h10v71Z" fill="#ffce1c" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
      <path d="M198 112V56c0-7-5-13-12-15h-10v71Z" fill="#ffce1c" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
      <rect x="12" y="100" width="216" height="16" rx="7" fill={`url(#${band})`} stroke={ink} strokeWidth="5" />
      <path d="M102 36h36v26a18 18 0 0 1-36 0Z" fill="#ffce1c" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
      <circle cx="120" cy="60" r="5" fill={ink} />
    </svg>
  );
}

export function CrateHint({ children }: { children: ReactNode }) {
  return <span className="loot-hint">{children}</span>;
}
