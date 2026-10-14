import type { CSSProperties } from "react";
import type { Hoggie } from "../features";
import { rewardChipAttributes } from "./RewardFlight";
import "./crates.css";

export type CratePhase = "closed" | "opening" | "open";

type CrateArtProps = { phase: CratePhase; width: number; Hog: Hoggie; nudge?: boolean; seen?: string };

export function CrateArt({ phase, width, Hog, nudge = false, seen }: CrateArtProps) {
  return (
    <span aria-hidden="true" className="crate-art" data-phase={phase} data-nudge={nudge || undefined} style={{ width } as CSSProperties} {...rewardChipAttributes(seen ?? null)}>
      <span className="crate-rays" />
      <svg viewBox="0 0 240 200" className="crate-layer">
        <ellipse cx="120" cy="190" rx="100" ry="9" className="crate-shadow" />
        <rect x="30" y="88" width="180" height="22" rx="8" className="crate-ink" />
      </svg>
      <span className="crate-hog">
        <Hog size={Math.round(width * 0.78)} title="" className="h-auto w-full" />
      </span>
      <svg viewBox="0 0 240 200" className="crate-layer">
        <rect x="22" y="98" width="196" height="88" rx="12" className="crate-body" />
        <path d="M27 128h186M27 156h186" className="crate-plank" />
        <rect x="40" y="98" width="20" height="88" className="crate-strap" />
        <rect x="180" y="98" width="20" height="88" className="crate-strap" />
        <rect x="96" y="104" width="48" height="50" rx="10" className="crate-strap" />
        <path d="M120 114 132 126 120 140 108 126Z" className="crate-gem" />
        <rect x="22" y="98" width="196" height="88" rx="12" className="crate-outline" />
      </svg>
      <svg viewBox="0 0 240 200" className="crate-layer crate-lid">
        <path d="M16 104V74c0-24 18-40 42-40h124c24 0 42 16 42 40v30Z" className="crate-body crate-lid-edge" />
        <path d="M16 88h208" className="crate-plank" />
        <path d="M40 104V50c0-6 4-12 10-14h10v68Z" className="crate-strap" />
        <path d="M200 104V50c0-6-4-12-10-14h-10v68Z" className="crate-strap" />
        <rect x="12" y="94" width="216" height="14" rx="6" className="crate-strap" />
        <path d="M106 34h28v28a14 14 0 0 1-28 0Z" className="crate-strap" />
        <circle cx="120" cy="60" r="5" className="crate-ink" />
      </svg>
    </span>
  );
}

export function CrateGlyph({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 22" className={className} aria-hidden="true">
      <rect x="2.5" y="10" width="19" height="10" rx="2" className="crate-body crate-glyph-line" />
      <path d="M2 11V8.5C2 5.5 4 3.5 7 3.5h10c3 0 5 2 5 5V11Z" className="crate-body crate-glyph-line" />
      <rect x="1.5" y="9.5" width="21" height="2.6" rx="1.2" className="crate-strap crate-glyph-line" />
      <rect x="9.5" y="11.5" width="5" height="5" rx="1.2" className="crate-strap crate-glyph-line" />
    </svg>
  );
}
