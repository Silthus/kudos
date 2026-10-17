// PROTOTYPE (#625): the World map's big moments: pack reveal with counting rewards, quest complete, level up, and flying loot. Never merge to main.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { HedgehogParty } from "../../../hoggies";
import { HoggieArt } from "../../art";
import { levelAt, rarityColour, type Drop, type PackKind } from "../../world";
import { Coin, PackArt, RarityPill, packLook } from "./bits";
import { prefersReducedMotion, useTicker } from "./motion";

type Vector = { x: number; y: number };

function vectorBetween(from: Element | null, to: Element | null): Vector | null {
  if (from === null || to === null) return null;
  const start = from.getBoundingClientRect();
  const end = to.getBoundingClientRect();
  return { x: end.left + end.width / 2 - (start.left + start.width / 2), y: end.top + end.height / 2 - (start.top + start.height / 2) };
}

export function Flyer({ to, delay, className = "", children }: { to: string; delay: number; className?: string; children: ReactNode }) {
  const self = useRef<HTMLSpanElement>(null);
  const [vector, setVector] = useState<Vector | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = window.setTimeout(() => setVector(vectorBetween(self.current, document.querySelector(to))), delay);
    return () => window.clearTimeout(timer);
  }, [to, delay]);
  const style = vector === null ? undefined : ({ "--dx": `${vector.x}px`, "--dy": `${vector.y}px` } as CSSProperties);
  return (
    <span className={`wm-flyer ${className}`}>
      <span ref={self}>{children}</span>
      <span className={`wm-flyer-ghost ${vector === null ? "" : "wm-flying"}`} style={style} aria-hidden="true">
        {children}
      </span>
    </span>
  );
}

type Phase = "sealed" | "tearing" | "revealed" | "settled";

function usePhase(): Phase {
  const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? "settled" : "sealed"));
  useEffect(() => {
    if (phase === "settled") return;
    const waits: Record<Exclude<Phase, "settled">, number> = { sealed: 520, tearing: 420, revealed: 1300 };
    const next: Record<Exclude<Phase, "settled">, Phase> = { sealed: "tearing", tearing: "revealed", revealed: "settled" };
    const timer = window.setTimeout(() => setPhase(next[phase]), waits[phase]);
    return () => window.clearTimeout(timer);
  }, [phase]);
  return phase;
}

type RevealProps = { drop: Drop; kind: PackKind; xpBefore: number; onCollect: () => void; onSeePage: () => void };

export function PackReveal({ drop, kind, xpBefore, onCollect, onSeePage }: RevealProps) {
  const phase = usePhase();
  const collect = useRef<HTMLButtonElement>(null);
  const opened = phase === "revealed" || phase === "settled";
  useEffect(() => {
    if (opened) collect.current?.focus({ preventScroll: true });
  }, [opened]);
  const levelled = drop.levelAfter > drop.levelBefore;
  return (
    <div className="wm-reveal-layer" role="dialog" aria-modal="true" aria-label={`You found ${drop.name}`} style={{ "--wm-rarity": rarityColour[drop.rarity] } as CSSProperties} data-phase={phase}>
      {!opened ? (
        <div className={`wm-reveal-sealed ${phase === "tearing" ? "wm-tearing" : ""}`}>
          <PackArt kind={kind} width={180} />
          <p>{packLook[kind].name}</p>
        </div>
      ) : (
        <div className="wm-reveal">
          <span className="wm-reveal-rays" aria-hidden="true" />
          <span className="wm-reveal-hoggie">
            <HoggieArt slug={drop.hoggie} size={190} />
            {drop.isNew && <span className="wm-reveal-new">NEW!</span>}
          </span>
          <RarityPill rarity={drop.rarity} />
          <h2 className="wm-reveal-name">{drop.name}</h2>
          <p className="wm-reveal-copy">{drop.isNew ? "A new page in your Hoggie book" : `Copy #${drop.copy}`}</p>
          <Gains drop={drop} />
          <RevealClimb xpBefore={xpBefore} gained={drop.xp} />
          {levelled && phase === "settled" && (
            <p className="wm-reveal-level">
              <HedgehogParty size={44} /> Level up! {drop.levelBefore} → {drop.levelAfter}
            </p>
          )}
          <div className="wm-reveal-actions">
            <button type="button" className="wm-button" onClick={onSeePage}>
              See its page
            </button>
            <button ref={collect} type="button" className="wm-button wm-button-gold" onClick={onCollect}>
              Collect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Gains({ drop }: { drop: Drop }) {
  const xp = useTicker(drop.xp, { delay: 250, ms: 1000 });
  const coins = useTicker(drop.coins, { delay: 450, ms: 1000 });
  return (
    <p className="wm-reveal-gains">
      {drop.xp > 0 && (
        <Flyer to='[data-wm-target="xp"]' delay={1400} className="wm-gain wm-gain-xp">
          <strong>+{xp}</strong> XP
        </Flyer>
      )}
      {drop.coins > 0 && (
        <Flyer to='[data-wm-target="coins"]' delay={1550} className="wm-gain wm-gain-coins">
          <Coin size={18} />
          <strong>+{coins}</strong>
        </Flyer>
      )}
    </p>
  );
}

function RevealClimb({ xpBefore, gained }: { xpBefore: number; gained: number }) {
  const xp = useTicker(xpBefore + gained, { from: xpBefore, delay: 250, ms: 1000 });
  const level = levelAt(xp);
  return (
    <div className="wm-reveal-climb">
      <span>Level {level.level}</span>
      <span className="wm-reveal-bar">
        <span style={{ width: `${level.progress * 100}%` }} />
      </span>
      <span>{level.toNext} XP to go</span>
    </div>
  );
}

export function QuestCompleteBanner({ name, kind }: { name: string; kind: PackKind }) {
  return (
    <div className="wm-banner wm-banner-quest" role="status">
      <span className="wm-banner-rays" aria-hidden="true" />
      <p className="wm-banner-kicker">Quest complete!</p>
      <p className="wm-banner-sub">{name}</p>
      <Flyer to='[data-wm-target="bag"]' delay={900} className="wm-banner-pack">
        <PackArt kind={kind} width={50} />
      </Flyer>
      <p className="wm-banner-small">A pack is in your bag</p>
    </div>
  );
}

export function LevelUpBanner({ level }: { level: number }) {
  return (
    <div className="wm-banner wm-banner-level" role="status">
      <span className="wm-banner-rays" aria-hidden="true" />
      <p className="wm-banner-kicker">Level up!</p>
      <p className="wm-banner-huge">Level {level}</p>
      <span className="wm-confetti" aria-hidden="true">
        {Array.from({ length: 24 }, (_, index) => (
          <span key={index} style={{ "--wm-x": `${(index * 41) % 100}%`, "--wm-hue": `${(index * 47) % 360}`, "--wm-delay": `${(index % 6) * 70}ms` } as CSSProperties} />
        ))}
      </span>
    </div>
  );
}
