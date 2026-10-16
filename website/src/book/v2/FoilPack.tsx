import { useEffect, useState, type CSSProperties } from "react";
import { rarityWordsOf } from "../../crates/drops";
import { DropArtwork } from "../../crates/Hoggie";
import { prefersReducedMotion } from "../../reducedMotion";
import type { Pack } from "./packs";
import "./reveals.css";

export type PackPhase = "sealed" | "tearing" | "sliding" | "flipping" | "reveal";

const following: Partial<Record<PackPhase, [PackPhase, number]>> = { tearing: ["sliding", 700], sliding: ["flipping", 900], flipping: ["reveal", 900] };

const wordsOnly = (rarity: string) => rarityWordsOf(rarity as never).replace(/^\S+\s/, "");

type FoilPackProps = { pack: Pack; width: number; autoOpen?: boolean; still?: boolean; onOpened?: () => void; onTap?: () => void; label?: string };

export function FoilPack({ pack, width, autoOpen = false, still = false, onOpened, onTap, label }: FoilPackProps) {
  const [reduced] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<PackPhase>(autoOpen ? (reduced ? "reveal" : "tearing") : "sealed");
  useEffect(() => {
    const next = following[phase];
    if (next === undefined) return;
    const timer = setTimeout(() => setPhase(next[0]), next[1]);
    return () => clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (phase === "reveal") onOpened?.();
  }, [phase, onOpened]);
  const open = () => {
    if (phase !== "sealed") return;
    if (onTap !== undefined) return onTap();
    setPhase(reduced ? "reveal" : "tearing");
  };
  const style = { "--pk-w": `${width}px`, "--glow": `var(--rarity-${pack.drop.rarity})` } as CSSProperties;
  return (
    <div className="pk-scene" data-phase={phase} data-rarity={pack.drop.rarity} data-still={still || undefined} style={style}>
      <span className="pk-rays" aria-hidden="true" />
      <button type="button" aria-label={label ?? `Tear pack ${pack.n} open`} disabled={phase !== "sealed" || still} onClick={open} className="rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-[var(--band-lemon)] disabled:cursor-default">
        <div className="pk-pack">
          <span className="pk-edge pk-top" aria-hidden="true" />
          <div className="pk-card" aria-hidden={phase !== "reveal"}>
            <div className="pk-face pk-back">
              <span className="hud-display font-extrabold text-white/60" style={{ fontSize: width * 0.08 }}>
                HedgeHug
              </span>
            </div>
            <div className="pk-face pk-front">
              <DropArtwork art={pack.drop.art} size={Math.round(width * 0.55)} />
              <span className="hud-display font-extrabold leading-tight" style={{ fontSize: width * 0.1 }}>
                {pack.drop.name}
              </span>
              <span className="font-bold uppercase tracking-[0.14em]" style={{ color: "var(--glow)", fontSize: Math.max(9, width * 0.05) }}>
                {wordsOnly(pack.drop.rarity)}
              </span>
            </div>
          </div>
          <div className="pk-body" aria-hidden="true">
            <span className="pk-logo">HedgeHug</span>
            <span className="pk-sub">{`Crate ${pack.n}`}</span>
          </div>
          <span className="pk-edge pk-bottom" aria-hidden="true" />
        </div>
      </button>
    </div>
  );
}
