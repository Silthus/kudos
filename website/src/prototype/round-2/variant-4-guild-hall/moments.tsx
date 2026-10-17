// PROTOTYPE (#625) round 2 variant 4: the big moments: the pack reveal with counting rewards, quest complete, level up, and things flying into the HUD. Never merge to main.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { prefersReducedMotion } from "../../../reducedMotion";
import { HoggieArt } from "../../art";
import { levelAt, rarityColour, type Drop, type Pack } from "../../world";
import { Coin, PackArt, RarityPill } from "./bits";
import { useClimb, useTicker } from "./motion";

type Vector = { x: number; y: number };

export function Flyer({ to, delay, className, children }: { to: string; delay: number; className: string; children: ReactNode }) {
  const self = useRef<HTMLSpanElement>(null);
  const [vector, setVector] = useState<Vector | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = window.setTimeout(() => setVector(vectorBetween(self.current, document.querySelector(to))), delay);
    return () => window.clearTimeout(timer);
  }, [to, delay]);
  const style = vector === null ? undefined : ({ "--dx": `${vector.x}px`, "--dy": `${vector.y}px` } as CSSProperties);
  return (
    <span className={`gh-flyer ${className}`}>
      <span ref={self}>{children}</span>
      <span className={`gh-flyer-ghost ${vector === null ? "" : "gh-flying"}`} style={style} aria-hidden="true">
        {children}
      </span>
    </span>
  );
}

function vectorBetween(from: Element | null, to: Element | null): Vector | null {
  if (from === null || to === null) return null;
  const start = from.getBoundingClientRect();
  const end = to.getBoundingClientRect();
  const scale = screenScale();
  return { x: (end.left + end.width / 2 - (start.left + start.width / 2)) / scale, y: (end.top + end.height / 2 - (start.top + start.height / 2)) / scale };
}

function screenScale() {
  const screen = document.querySelector(".gh-screen");
  if (!(screen instanceof HTMLElement) || screen.offsetWidth === 0) return 1;
  return screen.getBoundingClientRect().width / screen.offsetWidth;
}

type Phase = "sealed" | "torn" | "revealed";

function usePhase(): Phase {
  const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? "revealed" : "sealed"));
  useEffect(() => {
    if (phase === "revealed") return;
    const timer = window.setTimeout(() => setPhase(phase === "sealed" ? "torn" : "revealed"), phase === "sealed" ? 900 : 260);
    return () => window.clearTimeout(timer);
  }, [phase]);
  return phase;
}

export type Reveal = { drop: Drop; beforeXp: number; kind: Pack["kind"] };

export function PackReveal({ reveal: { drop, beforeXp, kind }, onCollect, onSeePage }: { reveal: Reveal; onCollect(): void; onSeePage(): void }) {
  const phase = usePhase();
  const collect = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (phase === "revealed") collect.current?.focus({ preventScroll: true });
  }, [phase]);
  const style = { "--rarity": rarityColour[drop.rarity] } as CSSProperties;
  return (
    <div className="gh-reveal-layer" role="dialog" aria-modal="true" aria-label={`You found ${drop.name}`} style={style}>
      {phase !== "revealed" ? (
        <div className={`gh-reveal-sealed gh-reveal-${phase}`}>
          <PackArt kind={kind} width={170} tearing={phase === "torn"} />
          <p>Opening…</p>
        </div>
      ) : (
        <div className="gh-reveal">
          <span className="gh-reveal-rays" aria-hidden="true" />
          <span className="gh-reveal-sparks" aria-hidden="true">
            {Array.from({ length: 12 }, (_, index) => (
              <span key={index} style={{ "--spark": index } as CSSProperties} />
            ))}
          </span>
          <span className="gh-reveal-hoggie">
            <HoggieArt slug={drop.hoggie} size={180} />
            {drop.isNew && <span className="gh-new-badge">NEW!</span>}
          </span>
          <RarityPill rarity={drop.rarity} />
          <h2 className="gh-reveal-name">{drop.name}</h2>
          <p className="gh-reveal-copy">{drop.isNew ? "A new page in your Hoggies book" : `Your copy #${drop.copy}`}</p>
          <Gains xp={drop.xp} coins={drop.coins} />
          <RevealClimb beforeXp={beforeXp} xp={drop.xp} />
          <div className="gh-reveal-actions">
            <button type="button" className="gh-button" onClick={onSeePage}>
              See its page
            </button>
            <button ref={collect} type="button" className="gh-button gh-button-gold" onClick={onCollect}>
              Collect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Gains({ xp, coins }: { xp: number; coins: number }) {
  const xpShown = useTicker(xp, { delay: 200 });
  const coinsShown = useTicker(coins, { delay: 450 });
  return (
    <p className="gh-gains">
      <span className="gh-gain gh-gain-xp">
        <strong>+{xpShown}</strong> XP
      </span>
      {coins > 0 && (
        <span className="gh-gain gh-gain-coins">
          <Coin size={20} />
          <strong>+{coinsShown}</strong>
        </span>
      )}
    </p>
  );
}

function RevealClimb({ beforeXp, xp }: { beforeXp: number; xp: number }) {
  const [target, setTarget] = useState(() => levelAt(beforeXp));
  useEffect(() => setTarget(levelAt(beforeXp + xp)), [beforeXp, xp]);
  const climb = useClimb(target, 350);
  return (
    <div className="gh-reveal-climb">
      <span className="gh-reveal-climb-level" key={climb.burst}>
        Level {climb.level}
      </span>
      <span className="gh-reveal-bar">
        <span className={climb.instant ? "gh-instant" : ""} style={{ width: `${climb.progress * 100}%` }} />
      </span>
      <span className="gh-muted">{climb.toNext} XP to {climb.level + 1}</span>
      {climb.burst > 0 && (
        <span className="gh-reveal-levelup" role="status">
          Level up!
        </span>
      )}
    </div>
  );
}

export function QuestCompleteBanner({ name }: { name: string }) {
  return (
    <div className="gh-toast gh-toast-quest" role="status">
      <p className="gh-toast-kicker">Quest complete!</p>
      <p className="gh-toast-sub">{name}</p>
      <p className="gh-toast-note">A pack dropped into your bag</p>
      <Flyer to='[data-gh-menu="bag"]' delay={1100} className="gh-float-pack">
        <PackArt kind="weekly" width={50} />
      </Flyer>
    </div>
  );
}

export function LevelUpBurst({ level }: { level: number }) {
  return (
    <div className="gh-toast gh-toast-level" role="status">
      <span className="gh-burst-rays" aria-hidden="true" />
      <p className="gh-toast-kicker">Level up!</p>
      <p className="gh-toast-huge">Level {level}</p>
    </div>
  );
}
