// PROTOTYPE (#625): the big moments: pack reveal with counted-up gains, quest complete, level up, and loot flying into the HUD. Never merge to main.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { prefersReducedMotion } from "../../../reducedMotion";
import { HoggieArt } from "../../art";
import { levelAt, type Drop, type Pack } from "../../world";
import { Coin, packName, PackArt, RarityPill } from "./bits";
import { useCountUp } from "./climb";

type Flight = { x: number; y: number; dx: number; dy: number };

function flightBetween(from: Element | null, to: Element | null): Flight | null {
  if (from === null || to === null) return null;
  const start = from.getBoundingClientRect();
  const end = to.getBoundingClientRect();
  const x = start.left + start.width / 2;
  const y = start.top + start.height / 2;
  return { x, y, dx: end.left + end.width / 2 - x, dy: end.top + end.height / 2 - y };
}

export function Flyer({ to, delay, children }: { to: string; delay: number; children: ReactNode }) {
  const self = useRef<HTMLSpanElement>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = window.setTimeout(() => setFlight(flightBetween(self.current, document.querySelector(to))), delay);
    return () => window.clearTimeout(timer);
  }, [to, delay]);
  return (
    <span ref={self} className="mr-flyer" aria-hidden="true">
      {flight !== null && (
        <span className="mr-flyer-ghost" style={{ left: flight.x, top: flight.y, "--dx": `${flight.dx}px`, "--dy": `${flight.dy}px` } as CSSProperties}>
          {children}
        </span>
      )}
    </span>
  );
}

type Phase = "sealed" | "burst" | "shown";

function usePhase(): Phase {
  const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? "shown" : "sealed"));
  useEffect(() => {
    if (phase === "shown") return;
    const timer = window.setTimeout(() => setPhase(phase === "sealed" ? "burst" : "shown"), phase === "sealed" ? 1000 : 260);
    return () => window.clearTimeout(timer);
  }, [phase]);
  return phase;
}

type RevealProps = { drop: Drop; pack: Pack["kind"]; xpBefore: number; onCollect(): void; onSeeInBook(): void };

export function Reveal({ drop, pack, xpBefore, onCollect, onSeeInBook }: RevealProps) {
  const phase = usePhase();
  const collect = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (phase === "shown") collect.current?.focus({ preventScroll: true });
  }, [phase]);
  return (
    <div className="mr-reveal-layer" role="dialog" aria-modal="true" aria-label={`${packName[pack]}: ${drop.name}`} style={{ "--rarity": `var(--rarity-${drop.rarity})` } as CSSProperties}>
      {phase !== "shown" ? (
        <div className={`mr-reveal-sealed ${phase === "burst" ? "mr-reveal-burst" : ""}`}>
          <span className="mr-sealed-glow" aria-hidden="true" />
          <PackArt kind={pack} height={220} />
          <p>Opening your {packName[pack].toLowerCase()}…</p>
        </div>
      ) : (
        <div className="mr-reveal">
          <span className="mr-reveal-rays" aria-hidden="true" />
          <span className="mr-reveal-hoggie">
            <HoggieArt slug={drop.hoggie} size={190} />
            {drop.isNew && <span className="mr-new">NEW!</span>}
          </span>
          <RarityPill rarity={drop.rarity} />
          <h2 className="mr-reveal-name">{drop.name}</h2>
          <p className="mr-reveal-copy">{drop.isNew ? "A new page in your Hoggie book" : `Copy #${drop.copy}`}</p>
          <Gains drop={drop} xpBefore={xpBefore} />
          <div className="mr-reveal-actions">
            <button type="button" className="mr-button mr-button-ghost" onClick={onSeeInBook}>
              See it in the book
            </button>
            <button ref={collect} type="button" className="mr-button mr-button-gold" onClick={onCollect}>
              Collect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Gains({ drop, xpBefore }: { drop: Drop; xpBefore: number }) {
  const xp = useCountUp(drop.xp, { delay: 250, ms: 1000 });
  const coins = useCountUp(drop.coins, { delay: 450, ms: 900 });
  const climbing = levelAt(xpBefore + xp);
  const levelled = climbing.level > drop.levelBefore;
  return (
    <div className="mr-gains">
      <p className="mr-gains-row">
        <span className="mr-gain mr-gain-xp">
          <strong>+{xp}</strong> XP
        </span>
        {drop.coins > 0 && (
          <span className="mr-gain mr-gain-coins">
            <Coin size={20} />
            <strong>+{coins}</strong>
          </span>
        )}
      </p>
      <div className="mr-gains-bar">
        <span className="mr-gains-level">Lv {climbing.level}</span>
        <span className="mr-gains-track">
          <span style={{ width: `${climbing.progress * 100}%` }} />
        </span>
        <span className="mr-gains-level">Lv {climbing.level + 1}</span>
      </div>
      {levelled && (
        <p className="mr-gains-levelup" role="status">
          Level up! {drop.levelBefore} → {drop.levelAfter}
        </p>
      )}
    </div>
  );
}

export function QuestCompleteBanner({ name, pack }: { name: string; pack: Pack["kind"] }) {
  return (
    <div className="mr-banner-wrap" role="status">
      <div className="mr-banner mr-banner-quest">
        <p className="mr-banner-big">Quest complete!</p>
        <p className="mr-banner-sub">{name}</p>
        <p className="mr-banner-loot">A {packName[pack].toLowerCase()} drops into your bags</p>
      </div>
      <Flyer to="[data-mr-pack-home]" delay={900}>
        <PackArt kind={pack} height={60} />
      </Flyer>
    </div>
  );
}

export function LevelUpBanner({ level }: { level: number }) {
  return (
    <div className="mr-banner-wrap" role="status">
      <div className="mr-banner mr-banner-level">
        <span className="mr-banner-rays" aria-hidden="true" />
        <p className="mr-banner-kicker">Level up!</p>
        <p className="mr-banner-huge">Level {level}</p>
        <p className="mr-banner-sub">Your hug grows stronger.</p>
      </div>
    </div>
  );
}

export function Toast({ children }: { children: ReactNode }) {
  return (
    <p className="mr-toast" role="status">
      {children}
    </p>
  );
}
