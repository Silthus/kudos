// PROTOTYPE (#625): the pack reveal: tear the foil, show the hoggie, count up the XP and coins, and beat on a level up. Never merge to main.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AppLink } from "../../AppLink";
import { prefersReducedMotion } from "../../reducedMotion";
import { HoggieArt } from "../art";
import { levelAt, rarityColour } from "../world";
import { Coin, LevelBar, useTicker } from "./motion";
import { FoilPack } from "./PackGlyph";
import type { Reveal } from "./stage";
import { ordinal, rarityName } from "./words";

type Phase = "tearing" | "revealed" | "settled";

const tearMs = 800;

const settleMs = 650;

function usePhase(): Phase {
  const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? "settled" : "tearing"));
  useEffect(() => {
    if (phase === "settled") return;
    const next = setTimeout(() => setPhase(phase === "tearing" ? "revealed" : "settled"), phase === "tearing" ? tearMs : settleMs);
    return () => clearTimeout(next);
  }, [phase]);
  return phase;
}

export function RevealDialog({ reveal: { drop, before, packName }, onClose }: { reveal: Reveal; onClose: () => void }) {
  const phase = usePhase();
  const done = useRef<HTMLButtonElement>(null);
  const after = levelAt(before.xp + drop.xp);
  const levelledUp = drop.levelAfter > drop.levelBefore;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    if (phase !== "tearing") done.current?.focus();
  }, [phase]);
  const style = { "--v3-rarity": rarityColour[drop.rarity] } as CSSProperties;
  return (
    <div className="v3-overlay" onClick={(event) => event.target === event.currentTarget && phase !== "tearing" && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`${packName}: ${drop.name}`} className="v3-reveal" data-phase={phase} style={style}>
        {phase === "tearing" ? (
          <div className="v3-reveal-pack">
            <FoilPack width={150} label={packName} tearing />
          </div>
        ) : (
          <>
            <div className="v3-reveal-card">
              <span className="v3-reveal-glow" aria-hidden="true" />
              <HoggieArt slug={drop.hoggie} size={168} />
            </div>
            <p className="v3-reveal-rarity">{rarityName[drop.rarity]}</p>
            <h2 className="v3-reveal-name">{drop.name}</h2>
            <p className="v3-reveal-new" data-new={drop.isNew || undefined}>
              {drop.isNew ? "New to your book" : `Your ${ordinal(drop.copy)} copy`}
            </p>
            <Gains xp={drop.xp} coins={drop.coins} />
            <div className="v3-reveal-climb">
              <div className="v3-reveal-levels">
                <span>{`Level ${phase === "settled" ? after.level : before.level}`}</span>
                <span className="v3-muted v3-num">{`${(phase === "settled" ? after : before).toNext} XP to level ${(phase === "settled" ? after.level : before.level) + 1}`}</span>
              </div>
              <LevelBar level={phase === "settled" ? after : before} size="md" label="Your level" />
            </div>
            {levelledUp && phase === "settled" && <p className="v3-level-up">{`Level ${drop.levelAfter}!`}</p>}
            <div className="v3-reveal-actions">
              <AppLink href={`/book#hoggies/${drop.rarity}`} className="v3-button" onFollow={onClose}>
                See it in the book
              </AppLink>
              <button ref={done} type="button" className="v3-button v3-button-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Gains({ xp, coins }: { xp: number; coins: number }) {
  const xpShown = useTicker(xp, { delay: 150 });
  const coinsShown = useTicker(coins, { delay: 300 });
  return (
    <p className="v3-gains">
      <span className="v3-gain">
        <strong className="v3-num">{`+${xpShown}`}</strong> XP
      </span>
      {coins > 0 && (
        <span className="v3-gain">
          <Coin size={18} />
          <strong className="v3-num">{`+${coinsShown}`}</strong> coins
        </span>
      )}
    </p>
  );
}
