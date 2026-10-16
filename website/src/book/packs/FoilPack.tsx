import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Drop } from "../../crates/drops";
import { DropArtwork } from "../../crates/Hoggie";
import { prefersReducedMotion } from "../../reducedMotion";
import { rarityNameOf, type PackState } from "./packs";
import "./packs.css";

export const packSlidesForMs = 700;

export const packFlipsForMs = 900;

type OpenedPhase = "sliding" | "flipping" | "reveal";

export type PackPhase = Exclude<PackState, "opened"> | OpenedPhase;

type FoilPackProps = { n: number; state: PackState; drop: Drop | null | undefined; width: number; label: string; still?: boolean; message?: string; onTap?: () => void; onRevealed?: () => void };

export function FoilPack({ n, state, drop, width, label, still = false, message, onTap, onRevealed }: FoilPackProps) {
  const phase = usePhase(state, onRevealed);
  const rarity = drop?.rarity ?? "common";
  const style = { "--pk-w": `${width}px`, "--glow": `var(--rarity-${rarity})` } as CSSProperties;
  return (
    <div className="pk-scene" data-phase={phase} data-rarity={rarity} data-still={still || undefined} style={style}>
      <span className="pk-rays" aria-hidden="true" />
      <button type="button" aria-label={label} disabled={phase !== "sealed"} onClick={onTap} className="pk-button">
        <div className="pk-pack">
          <span className="pk-edge pk-top" aria-hidden="true" />
          <div className="pk-card" aria-hidden={phase !== "reveal"}>
            <div className="pk-face pk-back">
              <span className="pk-back-mark">HedgeHug</span>
            </div>
            <div className="pk-face pk-front">{drop === undefined ? null : <CardFront drop={drop} width={width} />}</div>
          </div>
          <div className="pk-body" aria-hidden="true">
            <span className="pk-logo">HedgeHug</span>
            <span className="pk-sub">{`Pack ${n}`}</span>
          </div>
          <span className="pk-edge pk-bottom" aria-hidden="true" />
        </div>
      </button>
      {message !== undefined && <p className="pk-message">{message}</p>}
    </div>
  );
}

function CardFront({ drop, width }: { drop: Drop | null; width: number }) {
  if (drop === null) return <span className="pk-card-name">Opened</span>;
  return (
    <>
      <DropArtwork art={drop.art} size={Math.round(width * 0.55)} />
      <span className="pk-card-name">{drop.name}</span>
      <span className="pk-card-rarity">{rarityNameOf(drop.rarity)}</span>
    </>
  );
}

function usePhase(state: PackState, onRevealed: (() => void) | undefined): PackPhase {
  const [reduced] = useState(prefersReducedMotion);
  const [openedPhase, setOpenedPhase] = useState<OpenedPhase>();
  const revealed = useRef(false);
  const onRevealedNow = useRef(onRevealed);
  onRevealedNow.current = onRevealed;
  useEffect(() => {
    if (state !== "opened" || reduced) return;
    const flip = setTimeout(() => setOpenedPhase("flipping"), packSlidesForMs);
    const reveal = setTimeout(() => setOpenedPhase("reveal"), packSlidesForMs + packFlipsForMs);
    return () => {
      clearTimeout(flip);
      clearTimeout(reveal);
    };
  }, [state, reduced]);
  const phase: PackPhase = state === "opened" ? (openedPhase ?? (reduced ? "reveal" : "sliding")) : state;
  useEffect(() => {
    if (phase !== "reveal" || revealed.current) return;
    revealed.current = true;
    onRevealedNow.current?.();
  }, [phase]);
  return phase;
}
