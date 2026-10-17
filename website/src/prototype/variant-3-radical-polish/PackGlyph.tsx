// PROTOTYPE (#625): a small foil pack drawn for the Radical polish variant. Never merge to main.
import type { CSSProperties } from "react";
import { HedgehogHeart } from "../../hoggies";

export function PackGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 20 24" width={size * 0.84} height={size} aria-hidden="true" className="v3-pack-glyph">
      <path d="M2 3h16l-1 2 1 2v12l-1 2 1 2H2l1-2-1-2V7l1-2z" fill="#F54E00" stroke="#23251D" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5 9h10M5 15h10" stroke="#FFD2A8" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function FoilPack({ width, label, tearing = false }: { width: number; label: string; tearing?: boolean }) {
  return (
    <span className="v3-foil" data-tearing={tearing || undefined} style={{ "--v3-foil-w": `${width}px` } as CSSProperties}>
      <span className="v3-foil-crimp" aria-hidden="true" />
      <span className="v3-foil-body">
        <HedgehogHeart size={Math.round(width * 0.5)} />
        <span className="v3-foil-brand">HedgeHug</span>
        <span className="v3-foil-label">{label}</span>
      </span>
      <span className="v3-foil-crimp v3-foil-crimp-bottom" aria-hidden="true" />
    </span>
  );
}
