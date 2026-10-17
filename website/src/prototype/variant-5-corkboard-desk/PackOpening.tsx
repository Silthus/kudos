// PROTOTYPE (#625): opening a pack in the middle of the desk: the foil tears, the sticker slides out and flips, then it goes into the album.
import { useEffect, useState, type CSSProperties } from "react";
import { HoggieArt } from "../art";
import { rarityColour, type Drop, type PackKind } from "../world";
import { useReducedMotion } from "./motion";
import { PackFace, packLook } from "./Shelf";

type Phase = "tear" | "slide" | "flip";

const phaseAt: Array<[Phase, number]> = [
  ["slide", 900],
  ["flip", 1500],
];

function usePhase() {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduced ? "flip" : "tear");
  useEffect(() => {
    if (reduced) return;
    const timers = phaseAt.map(([next, at]) => window.setTimeout(() => setPhase(next), at));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [reduced]);
  return phase;
}

export function PackOpening({ drop, kind, onStick }: { drop: Drop; kind: PackKind; onStick: () => void }) {
  const phase = usePhase();
  const levelledUp = drop.levelAfter > drop.levelBefore;
  return (
    <div className={`v5-opening v5-opening-${phase}`} role="dialog" aria-modal="true" aria-label="Opening a pack" style={{ "--rarity": rarityColour[drop.rarity] } as CSSProperties}>
      <div className={`v5-opening-pack v5-pack ${packLook[kind].className}`} aria-hidden="true">
        <span className="v5-opening-strip" />
        <PackFace kind={kind} />
      </div>
      <div className="v5-opening-hand" aria-hidden="true">
        <span className="v5-fan-card v5-fan-card-1" />
        <span className="v5-fan-card v5-fan-card-2" />
      </div>
      <div className="v5-opening-card">
        <div className="v5-opening-card-inner">
          <div className="v5-opening-back">
            <span>HedgeHug</span>
          </div>
          <div className={`v5-opening-front v5-foil-${drop.rarity}`}>
            {drop.isNew ? <span className="v5-new-ribbon">NEW!</span> : <span className="v5-copy-ribbon">Copy ×{drop.copy}</span>}
            <HoggieArt slug={drop.hoggie} size={150} />
            <span className="v5-opening-name">{drop.name}</span>
            <span className="v5-opening-rarity">{drop.rarity}</span>
          </div>
        </div>
      </div>
      {phase === "flip" && (
        <div className="v5-opening-gains">
          <div className="v5-gain-chips">
            {drop.xp > 0 && <span className="v5-gain v5-gain-xp">+{drop.xp} XP</span>}
            {drop.coins > 0 && <span className="v5-gain v5-gain-coins">+{drop.coins} coins</span>}
          </div>
          {levelledUp && (
            <p className="v5-level-up-beat">
              <span className="v5-level-up-star">★</span> Level up! {drop.levelBefore} → {drop.levelAfter}
            </p>
          )}
          <button type="button" className="v5-stick-button" onClick={onStick} autoFocus>
            {drop.isNew ? "Stick it in the album" : "File the copy in the album"} →
          </button>
        </div>
      )}
    </div>
  );
}
