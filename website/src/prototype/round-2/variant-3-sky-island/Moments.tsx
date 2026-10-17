// PROTOTYPE (#625): Sky island's big moments: the pack reveal with counting XP and coins, quest complete, and flying rewards. Never merge to main.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { prefersReducedMotion } from "../../../reducedMotion";
import { HoggieArt } from "../../art";
import { rarityColour, type Drop, type PackKind } from "../../world";
import { useTicking } from "./climb";
import { Coin, PackArt, packLook, rarityLabel } from "./looks";

type Phase = "shaking" | "burst" | "shown";

const phaseMs: Record<Exclude<Phase, "shown">, number> = { shaking: 900, burst: 260 };

function useRevealPhase() {
  const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? "shown" : "shaking"));
  useEffect(() => {
    if (phase === "shown") return;
    const timer = window.setTimeout(() => setPhase(phase === "shaking" ? "burst" : "shown"), phaseMs[phase]);
    return () => window.clearTimeout(timer);
  }, [phase]);
  return phase;
}

export function PackReveal({ drop, kind, onCollect, onSeePage }: { drop: Drop; kind: PackKind; onCollect: () => void; onSeePage: () => void }) {
  const phase = useRevealPhase();
  const collect = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (phase === "shown") collect.current?.focus({ preventScroll: true });
  }, [phase]);
  const levelled = drop.levelAfter > drop.levelBefore;
  return (
    <div className="sk-reveal-layer" role="dialog" aria-modal="true" aria-label={`You found ${drop.name}`} style={{ "--rarity": rarityColour[drop.rarity] } as CSSProperties} data-phase={phase}>
      {phase !== "shown" ? (
        <div className={`sk-reveal-pack ${phase === "burst" ? "sk-reveal-bursting" : ""}`}>
          <PackArt kind={kind} size={220} />
          <p>{packLook[kind].name}</p>
        </div>
      ) : (
        <div className="sk-reveal">
          <span className="sk-reveal-rays" aria-hidden="true" />
          <span className="sk-reveal-sparks" aria-hidden="true">
            {Array.from({ length: 12 }, (_, index) => (
              <span key={index} style={{ "--i": index } as CSSProperties} />
            ))}
          </span>
          <span className="sk-reveal-hoggie">
            <HoggieArt slug={drop.hoggie} size={190} />
            {drop.isNew && <span className="sk-reveal-new">NEW!</span>}
          </span>
          <span className="sk-reveal-rarity">{rarityLabel[drop.rarity]}</span>
          <h2 className="sk-reveal-name">{drop.name}</h2>
          <p className="sk-reveal-copy">{drop.isNew ? "A new page fills in your Hoggies book" : `Your copy #${drop.copy}`}</p>
          <Gains xp={drop.xp} coins={drop.coins} />
          {levelled && <LevelBeat level={drop.levelAfter} />}
          <div className="sk-reveal-actions">
            <button type="button" className="sk-button" onClick={onSeePage}>
              See its page
            </button>
            <button ref={collect} type="button" className="sk-button sk-button-gold sk-button-big" onClick={onCollect}>
              Collect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Gains({ xp, coins }: { xp: number; coins: number }) {
  const xpShown = useTicking(xp, { from: 0, delay: 250, ms: 1000 });
  const coinsShown = useTicking(coins, { from: 0, delay: 450, ms: 900 });
  return (
    <p className="sk-gains">
      <Flyer to='[data-sk-target="xp"]' delay={1500}>
        <span className="sk-gain sk-gain-xp">
          <strong>+{xpShown}</strong> XP
        </span>
      </Flyer>
      {coins > 0 && (
        <Flyer to='[data-sk-target="coins"]' delay={1650}>
          <span className="sk-gain sk-gain-coins">
            <Coin size={20} />
            <strong>+{coinsShown}</strong>
          </span>
        </Flyer>
      )}
    </p>
  );
}

function LevelBeat({ level }: { level: number }) {
  const [shown, setShown] = useState(prefersReducedMotion);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(true), 1700);
    return () => window.clearTimeout(timer);
  }, []);
  if (!shown) return <p className="sk-level-beat sk-level-beat-waiting">…</p>;
  return (
    <p className="sk-level-beat">
      <span className="sk-level-beat-rays" aria-hidden="true" />
      Level up! <strong>{level}</strong>
    </p>
  );
}

type Vector = { x: number; y: number };

export function Flyer({ to, delay, children }: { to: string; delay: number; children: ReactNode }) {
  const self = useRef<HTMLSpanElement>(null);
  const [vector, setVector] = useState<Vector | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = window.setTimeout(() => setVector(vectorBetween(self.current, document.querySelector(to))), delay);
    return () => window.clearTimeout(timer);
  }, [to, delay]);
  const style = vector === null ? undefined : ({ "--dx": `${vector.x}px`, "--dy": `${vector.y}px` } as CSSProperties);
  return (
    <span className="sk-flyer">
      <span ref={self}>{children}</span>
      <span className={`sk-flyer-ghost ${vector === null ? "" : "sk-flying"}`} style={style} aria-hidden="true">
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

export function QuestComplete({ name, kind }: { name: string; kind: PackKind }) {
  return (
    <div className="sk-banner sk-banner-quest" role="status">
      <span className="sk-banner-confetti" aria-hidden="true">
        {Array.from({ length: 14 }, (_, index) => (
          <span key={index} style={{ "--i": index } as CSSProperties} />
        ))}
      </span>
      <p className="sk-banner-big">Quest complete!</p>
      <p className="sk-banner-sub">{name}</p>
      <p className="sk-banner-pack">
        <Flyer to='[data-sk-target="inventory"]' delay={1100}>
          <PackArt kind={kind} size={60} />
        </Flyer>
        <span>A pack landed in your inventory</span>
      </p>
    </div>
  );
}

export function LevelUpBurst({ level }: { level: number }) {
  return (
    <div className="sk-banner sk-banner-level" role="status">
      <span className="sk-banner-rays" aria-hidden="true" />
      <p className="sk-banner-kicker">Level up!</p>
      <p className="sk-banner-huge">Level {level}</p>
    </div>
  );
}
