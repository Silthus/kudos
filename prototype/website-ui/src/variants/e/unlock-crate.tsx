// Variant E crate: the loot crate a member opens, from drop-in and shake to the lid bursting off and a hedgehog rising out, used for feature unlocks and rewards alike, plus the small crate glyph the chrome uses.
import { useEffect, useId, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "./hud";
import { featureLook } from "./unlock-features";
import { openUnlock, unlockOf, type Feature } from "./unlocks";
import "./moments.css";

const ink = "#141414";
const tangerine = "#FF5C1C";
const ember = "#D9420B";
const lemon = "#FFCE1C";
const blue = "#106FB2";

type CratePhase = "drop" | "closed" | "shake" | "burst" | "open";

const following: Partial<Record<CratePhase, [CratePhase, number]>> = { drop: ["closed", 900], shake: ["burst", 700], burst: ["open", 1000] };

export const isOpened = (phase: CratePhase) => phase === "burst" || phase === "open";

export function useCrateOpening({ dropIn = true, onOpened }: { dropIn?: boolean; onOpened?: () => void } = {}) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<CratePhase>(dropIn && !reduced ? "drop" : "closed");
  const latestOnOpened = useRef(onOpened);
  latestOnOpened.current = onOpened;
  const opened = isOpened(phase);
  useEffect(() => {
    const next = following[phase];
    if (!next) return;
    const timer = setTimeout(() => setPhase(next[0]), next[1]);
    return () => clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (opened) latestOnOpened.current?.();
  }, [opened]);
  const open = () => setPhase((p) => (p === "drop" || p === "closed" ? (reduced ? "open" : "shake") : p));
  return { phase, open };
}

export const useFeatureCrate = (feature: Feature) => useCrateOpening({ onOpened: () => openUnlock(feature) });

const sparks = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2 + (i % 2) * 0.2;
  const reach = 120 + (i % 3) * 40;
  return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach * 0.8 - 40, d: 0.04 * (i % 5), tone: [lemon, "#ffffff", tangerine][i % 3], size: 10 + (i % 3) * 5 };
});

type HogArt = ComponentType<{ size?: number; className?: string; title?: string }>;

type StageOptions = { phase: CratePhase; onOpen: () => void; width?: number; hint?: string; headroom?: boolean; autoFocus?: boolean };

type CrateStageProps = StageOptions & { Hog: HogArt; name: string };

export function FeatureCrateStage({ feature, ...options }: StageOptions & { feature: Feature }) {
  return <CrateStage {...options} Hog={featureLook[feature].Hog} name={unlockOf(feature).name} />;
}

export function CrateStage({ Hog, name, phase, onOpen, width = 240, hint = "Tap to open", headroom = true, autoFocus = false }: CrateStageProps) {
  const closed = !isOpened(phase);
  const crate = (
    <span className="uc-crate" data-phase={phase} style={{ width, "--uc-w": `${width}px` } as CSSProperties}>
      <span className="uc-rays" aria-hidden />
      <span className="uc-flash" aria-hidden />
      <span className="uc-ring" aria-hidden />
      <CrateArt>
        <span className="uc-hog" aria-hidden={closed}>
          <Hog size={Math.round(width * 0.78)} className="h-auto w-full" title={closed ? "" : name} />
        </span>
      </CrateArt>
      {sparks.map((s, i) => (
        <svg key={i} viewBox="0 0 16 16" className="uc-spark" style={{ "--x": `${s.x * (width / 240)}px`, "--y": `${s.y * (width / 240)}px`, "--d": `${s.d}s`, width: s.size, height: s.size, color: s.tone } as CSSProperties} aria-hidden>
          <path d="M8 0 9.8 6.2 16 8 9.8 9.8 8 16 6.2 9.8 0 8 6.2 6.2Z" fill="currentColor" />
        </svg>
      ))}
    </span>
  );
  return (
    <div className="uc-stage" style={{ paddingTop: headroom ? width * 0.62 : 0 }}>
      {closed ? (
        <button type="button" className="uc-button" onClick={onOpen} aria-label={`Open the crate: ${name}`} autoFocus={autoFocus}>
          {crate}
        </button>
      ) : (
        crate
      )}
      <span className={`uc-hint ${closed ? "" : "is-gone"}`} aria-hidden>
        {hint}
      </span>
    </div>
  );
}

function CrateArt({ children }: { children: ReactNode }) {
  const seam = useId();
  const sheen = useId();
  return (
    <>
      <svg viewBox="0 0 240 200" className="uc-layer uc-back" aria-hidden>
        <defs>
          <radialGradient id={seam} cx="50%" cy="100%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor={lemon} stopOpacity="0.95" />
            <stop offset="100%" stopColor={lemon} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="120" cy="190" rx="100" ry="9" fill={ink} opacity=".28" />
        <ellipse className="uc-inner-glow" cx="120" cy="96" rx="118" ry="70" fill={`url(#${seam})`} />
        <rect x="30" y="88" width="180" height="22" rx="8" fill={ink} />
      </svg>
      {children}
      <svg viewBox="0 0 240 200" className="uc-layer uc-front" aria-hidden>
        <defs>
          <linearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity=".28" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="22" y="98" width="196" height="88" rx="12" fill={tangerine} stroke={ink} strokeWidth="5" />
        <path d="M27 128h186M27 156h186" stroke={ember} strokeWidth="4" />
        <rect x="22" y="98" width="196" height="88" rx="12" fill={`url(#${sheen})`} />
        <rect x="40" y="98" width="20" height="88" fill={lemon} stroke={ink} strokeWidth="4" />
        <rect x="180" y="98" width="20" height="88" fill={lemon} stroke={ink} strokeWidth="4" />
        <circle cx="50" cy="114" r="3.5" fill={ink} />
        <circle cx="50" cy="170" r="3.5" fill={ink} />
        <circle cx="190" cy="114" r="3.5" fill={ink} />
        <circle cx="190" cy="170" r="3.5" fill={ink} />
        <rect x="96" y="104" width="48" height="50" rx="10" fill={lemon} stroke={ink} strokeWidth="5" />
        <path d="M120 114 132 126 120 140 108 126Z" fill={blue} stroke={ink} strokeWidth="4" strokeLinejoin="round" />
        <path d="M115 122 120 117" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity=".8" />
        <rect x="22" y="98" width="196" height="88" rx="12" fill="none" stroke={ink} strokeWidth="5" />
      </svg>
      <span className="uc-seam" aria-hidden />
      <svg viewBox="0 0 240 200" className="uc-layer uc-lid" aria-hidden>
        <path d="M16 104V74c0-24 18-40 42-40h124c24 0 42 16 42 40v30Z" fill={tangerine} stroke={ink} strokeWidth="5" strokeLinejoin="round" />
        <path d="M32 66c4-12 14-20 28-20h56" fill="none" stroke="#ffffff" strokeOpacity=".5" strokeWidth="5" strokeLinecap="round" />
        <path d="M16 88h208" stroke={ember} strokeWidth="4" />
        <path d="M40 104V50c0-6 4-12 10-14h10v68Z" fill={lemon} stroke={ink} strokeWidth="4" strokeLinejoin="round" />
        <path d="M200 104V50c0-6-4-12-10-14h-10v68Z" fill={lemon} stroke={ink} strokeWidth="4" strokeLinejoin="round" />
        <rect x="12" y="94" width="216" height="14" rx="6" fill={lemon} stroke={ink} strokeWidth="5" />
        <path d="M106 34h28v28a14 14 0 0 1-28 0Z" fill={lemon} stroke={ink} strokeWidth="4" strokeLinejoin="round" />
        <circle cx="120" cy="60" r="5" fill={ink} />
      </svg>
    </>
  );
}

export function CrateGlyph({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 22" className={className} aria-hidden>
      <rect x="2.5" y="10" width="19" height="10" rx="2" fill={tangerine} stroke={ink} strokeWidth="1.6" />
      <path d="M2 11V8.5C2 5.5 4 3.5 7 3.5h10c3 0 5 2 5 5V11Z" fill={tangerine} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="1.5" y="9.5" width="21" height="2.6" rx="1.2" fill={lemon} stroke={ink} strokeWidth="1.4" />
      <rect x="9.5" y="11.5" width="5" height="5" rx="1.2" fill={lemon} stroke={ink} strokeWidth="1.4" />
    </svg>
  );
}
