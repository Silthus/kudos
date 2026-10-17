// PROTOTYPE (#625): the Game HUD's big moments: loot reveal, quest complete and level up, with rewards flying into the HUD. Never merge to main.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { prefersReducedMotion } from "../../reducedMotion";
import { HoggieArt } from "../art";
import type { Drop } from "../world";
import { Coins, PackArt, RarityPill } from "./pages";

type Vector = { x: number; y: number };

function Flyer({ to, delay, className, children }: { to: string; delay: number; className: string; children: ReactNode }) {
  const self = useRef<HTMLSpanElement>(null);
  const [vector, setVector] = useState<Vector | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = window.setTimeout(() => setVector(vectorBetween(self.current, document.querySelector(to))), delay);
    return () => window.clearTimeout(timer);
  }, [to, delay]);
  const style = vector === null ? undefined : ({ "--dx": `${vector.x}px`, "--dy": `${vector.y}px` } as CSSProperties);
  return (
    <span className={`v1-flyer ${className}`}>
      <span ref={self}>{children}</span>
      <span className={`v1-flyer-ghost ${vector === null ? "" : "v1-flying"}`} style={style} aria-hidden="true">
        {children}
      </span>
    </span>
  );
}

function vectorBetween(from: Element | null, to: Element | null): Vector | null {
  if (from === null || to === null) return null;
  const start = from.getBoundingClientRect();
  const end = to.getBoundingClientRect();
  return { x: end.left + end.width / 2 - (start.left + start.width / 2), y: end.top + end.height / 2 - (start.top + start.height / 2) };
}

const sealedMs = 700;

export function LootReveal({ drop, onCollect }: { drop: Drop; onCollect(): void }) {
  const [open, setOpen] = useState(prefersReducedMotion);
  const collect = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => setOpen(true), sealedMs);
    return () => window.clearTimeout(timer);
  }, [open]);
  useEffect(() => {
    if (open) collect.current?.focus({ preventScroll: true });
  }, [open]);
  const levelled = drop.levelAfter > drop.levelBefore;
  return (
    <div className="v1-reveal-layer" role="dialog" aria-label={`You found ${drop.name}`} style={{ "--rarity": `var(--rarity-${drop.rarity})` } as CSSProperties}>
      {!open ? (
        <div className="v1-reveal-sealed">
          <PackArt size={210} />
          <p>Opening…</p>
        </div>
      ) : (
        <div className="v1-reveal">
          <span className="v1-reveal-rays" aria-hidden="true" />
          <span className="v1-reveal-hoggie">
            <HoggieArt slug={drop.hoggie} size={190} />
            {drop.isNew && <span className="v1-new">NEW!</span>}
          </span>
          <RarityPill rarity={drop.rarity} />
          <h2 className="v1-reveal-name">{drop.name}</h2>
          <p className="v1-reveal-copy">{drop.isNew ? "A new page in your book" : `Copy #${drop.copy}`}</p>
          <p className="v1-reveal-rewards">
            {drop.xp > 0 && (
              <Flyer to='[data-v1-target="xp"]' delay={350} className="v1-float-xp">
                +{drop.xp} XP
              </Flyer>
            )}
            {drop.coins > 0 && (
              <Flyer to='[data-v1-target="coins"]' delay={500} className="v1-float-coins">
                +<Coins amount={drop.coins} />
              </Flyer>
            )}
          </p>
          {levelled && <p className="v1-reveal-level">Level up! {drop.levelBefore} → {drop.levelAfter}</p>}
          <button ref={collect} type="button" className="v1-button v1-button-gold v1-reveal-collect" onClick={onCollect}>
            Collect
          </button>
        </div>
      )}
    </div>
  );
}

export function QuestCompleteBanner({ name }: { name: string }) {
  return (
    <div className="v1-banner v1-banner-quest" role="status">
      <p className="v1-banner-big">Quest complete!</p>
      <p className="v1-banner-sub">{name}</p>
      <Flyer to='[data-v1-slot="4"]' delay={1000} className="v1-float-pack">
        <PackArt size={56} />
      </Flyer>
    </div>
  );
}

export function LevelUpBanner({ level }: { level: number }) {
  return (
    <div className="v1-banner v1-banner-level" role="status">
      <span className="v1-banner-rays" aria-hidden="true" />
      <p className="v1-banner-kicker">Level up!</p>
      <p className="v1-banner-huge">Level {level}</p>
    </div>
  );
}
