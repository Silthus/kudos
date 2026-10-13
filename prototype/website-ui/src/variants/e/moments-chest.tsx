// Variant E moments: the hand-built treasure chest and egg that open to reveal a found item.
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "./hud";

const ink = "#141414";
const tangerine = "#FF5C1C";
const lemon = "#FFCE1C";
const blue = "#106FB2";
const cream = "#FFF6E0";

export function useBeat(ms: number) {
  const reduced = useReducedMotion();
  const [done, setDone] = useState(reduced);
  useEffect(() => {
    if (reduced) return setDone(true);
    const timer = setTimeout(() => setDone(true), ms);
    return () => clearTimeout(timer);
  }, [ms, reduced]);
  return done || reduced;
}

export function useOpenable(autoOpenAfter: number) {
  const beat = useBeat(autoOpenAfter);
  const [clicked, setClicked] = useState(false);
  return { open: beat || clicked, openNow: () => setClicked(true) };
}

type RevealProps = { open: boolean; onOpen?: () => void; width: number; label: string; item: ReactNode; tapHint?: string };

export function Chest(props: RevealProps) {
  return <RevealShell {...props} overlap={0.24} art={<ChestArt />} />;
}

export function Egg(props: RevealProps) {
  return <RevealShell {...props} overlap={0.8} art={<EggArt />} />;
}

const sparks: Array<{ x: number; y: number; d: number }> = [
  { x: -110, y: -60, d: 0.2 },
  { x: 120, y: -50, d: 0.25 },
  { x: -70, y: -130, d: 0.3 },
  { x: 80, y: -140, d: 0.22 },
  { x: -140, y: 10, d: 0.35 },
  { x: 150, y: 0, d: 0.32 },
];

function RevealShell({ open, onOpen, width, label, item, tapHint, art, overlap }: RevealProps & { art: ReactNode; overlap: number }) {
  const reduced = useReducedMotion();
  const interactive = Boolean(onOpen) && !open;
  const body = (
    <>
      <span className="mo-rays" aria-hidden />
      <div className="mo-item" aria-hidden={!open}>
        {item}
      </div>
      <div className="mo-art" style={{ width, marginTop: -width * overlap }}>
        {art}
      </div>
      {!reduced &&
        sparks.map((s, i) => (
          <svg key={i} viewBox="0 0 16 16" className="mo-spark" style={{ "--x": `${s.x * (width / 200)}px`, "--y": `${s.y * (width / 200)}px`, "--d": `${s.d}s` } as CSSProperties} aria-hidden>
            <path d="M8 0 9.8 6.2 16 8 9.8 9.8 8 16 6.2 9.8 0 8 6.2 6.2Z" fill="currentColor" />
          </svg>
        ))}
      {tapHint && <span className="mo-tap mt-3 text-[11px] font-semibold uppercase tracking-[0.18em]">{tapHint}</span>}
    </>
  );
  const className = `mo-reveal ${open ? "is-open" : ""}`;
  return interactive ? (
    <button type="button" className={`${className} mo-reveal-button`} onClick={onOpen} aria-label={label}>
      {body}
    </button>
  ) : (
    <div className={className} role="group" aria-label={label}>
      {body}
    </div>
  );
}

function ChestArt() {
  const glow = useId();
  return (
    <>
      <svg viewBox="0 0 200 170" className="mo-art-back" aria-hidden>
        <defs>
          <radialGradient id={glow} cx="50%" cy="100%" r="80%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor={lemon} stopOpacity="0.9" />
            <stop offset="100%" stopColor={lemon} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse className="mo-glow" cx="100" cy="66" rx="96" ry="44" fill={`url(#${glow})`} />
        <rect x="22" y="62" width="156" height="18" rx="7" fill={ink} />
        <g className="mo-lid">
          <path d="M20 76V50c0-16 12-28 28-28h104c16 0 28 12 28 28v26Z" fill={tangerine} stroke={ink} strokeWidth="4" strokeLinejoin="round" />
          <path d="M34 44c2-8 8-12 16-12h40" fill="none" stroke="#ffffff" strokeOpacity=".45" strokeWidth="4" strokeLinecap="round" />
          <rect x="88" y="22" width="24" height="54" fill={lemon} stroke={ink} strokeWidth="4" strokeLinejoin="round" />
        </g>
      </svg>
      <svg viewBox="0 0 200 170" className="mo-art-front" aria-hidden>
        <rect x="16" y="74" width="168" height="84" rx="10" fill={tangerine} stroke={ink} strokeWidth="4" />
        <path d="M20 138h160v8a10 10 0 0 1-10 10H30a10 10 0 0 1-10-10Z" fill={ink} opacity=".14" />
        <rect x="88" y="74" width="24" height="84" fill={lemon} stroke={ink} strokeWidth="4" strokeLinejoin="round" />
        <rect x="80" y="82" width="40" height="34" rx="8" fill={lemon} stroke={ink} strokeWidth="4" />
        <circle cx="100" cy="96" r="5" fill={ink} />
        <rect x="98" y="98" width="4" height="10" rx="2" fill={ink} />
        <path d="M30 88h40M130 88h40" stroke="#ffffff" strokeOpacity=".4" strokeWidth="4" strokeLinecap="round" />
        <rect x="16" y="74" width="168" height="84" rx="10" fill="none" stroke={ink} strokeWidth="4" />
      </svg>
    </>
  );
}

const eggPath = "M80 10C122 10 148 84 148 124c0 44-30 68-68 68S12 168 12 124C12 84 38 10 80 10Z";
const crack = "M0 0H160V104L142 92 124 108 104 90 84 110 64 92 44 108 26 92 0 106Z";
const below = "M0 200H160V104L142 92 124 108 104 90 84 110 64 92 44 108 26 92 0 106Z";

function EggShell({ clip }: { clip: string }) {
  return (
    <g clipPath={`url(#${clip})`}>
      <path d={eggPath} fill={cream} />
      <circle cx="54" cy="58" r="10" fill={lemon} />
      <circle cx="104" cy="44" r="7" fill={blue} />
      <circle cx="110" cy="138" r="12" fill={tangerine} />
      <circle cx="46" cy="150" r="8" fill={blue} />
      <circle cx="78" cy="96" r="6" fill={tangerine} />
      <path d="M40 60c4-16 12-28 22-36" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
      <path d={eggPath} fill="none" stroke={ink} strokeWidth="4" />
    </g>
  );
}

function EggArt() {
  const top = useId();
  const bottom = useId();
  return (
    <>
      <svg viewBox="0 0 160 200" className="mo-art-back" aria-hidden>
        <ellipse className="mo-glow" cx="80" cy="104" rx="70" ry="22" fill={lemon} opacity=".9" />
      </svg>
      <svg viewBox="0 0 160 200" className="mo-art-front" aria-hidden overflow="visible">
        <defs>
          <clipPath id={top}>
            <path d={crack} />
          </clipPath>
          <clipPath id={bottom}>
            <path d={below} />
          </clipPath>
        </defs>
        <EggShell clip={bottom} />
        <path d="M14 106 26 92 44 108 64 92 84 110 104 90 124 108 142 92 147 98" fill="none" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
        <g className="mo-shell-top">
          <EggShell clip={top} />
        </g>
      </svg>
    </>
  );
}
