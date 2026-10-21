// PROTOTYPE (Silthus/personal#98), throwaway: round 2, the whole dim canvas.
// Every excerpt lands on the canvas at once, a little staggered, so the whole scene reads at a glance.
// A click anywhere, or a timeout that grows with the number of excerpts, dissolves them into XP particles
// that fly into the top-bar XP bar. Then the waiting items land on the same canvas.
// D "Scatter & poof": scattered, tilted excerpts; a draining line and "Click anywhere"; each one poofs into particles.
// E "XP orb": excerpts ring a glowing orb that soaks up their XP while you read; tap the orb (or wait) and it streams into the bar.
// F "Wall & crumble": a tidy wall; the incoming XP already shows as a ghost on the XP bar with a countdown; excerpts crumble left to right.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Album, AlbumLevel } from "../answer";
import { levelOf, xpToReach, type Pace, type Scenario } from "./moments";
import { centreOf, clearParticles, crumble, particlesFor, poof, stream, toTheBar } from "./particles";
import { popTheLevel } from "./sequence";
import { ExcerptCard, FoldLine, HandoffBoard, itemsWords, publishLine } from "./XpMomentsPrototype";
import "./scatter.css";

export type ScatterVariant = "D" | "E" | "F" | "G" | "H";

function hasOrb(variant: ScatterVariant) {
  return variant === "E" || variant === "G" || variant === "H";
}

type Phase = "settle" | "arrive" | "hold" | "collect" | "items";

type Card = { key: number; xp: number; node: (compact: boolean) => ReactNode; moments: number };

type Placed = { x: number; y: number; rot: number; width: number };

type Props = { variant: ScatterVariant; scenario: Scenario; pace: Pace; reduced: boolean; me: string; onShown: (shown: { level: Album["level"]; moving: boolean }) => void };

const noChip = () => {};

export function ScatterSequence({ variant, scenario, pace, reduced, me, onShown }: Props) {
  const cards = useMemo(() => cardsOf(scenario, me), [scenario, me]);
  const total = cards.reduce((sum, card) => sum + card.xp, 0);
  const moments = cards.reduce((sum, card) => sum + card.moments, 0);
  const final = scenario.startXp + total;
  const [phase, setPhase] = useState<Phase>(reduced ? "items" : "settle");
  const [xp, setXp] = useState(reduced ? final : scenario.startXp);
  const [orbXp, setOrbXp] = useState(0);
  const [closed, setClosed] = useState<"open" | "later" | "board">("open");
  const viewport = useViewport();
  const placed = layoutOf(variant, cards.length, viewport);
  const cardElements = useRef(new Map<number, HTMLElement>());
  const orb = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const holdMs = pace.holdBase + pace.holdPer * cards.length;
  const arriveMs = pace.stagger * cards.length + 550;
  const settled = useRef(reduced);
  const addXp = useBatchedAdd(setXp, settled);
  const addOrbXp = useBatchedAdd(setOrbXp, settled);

  const later = (ms: number, then: () => void) => timers.current.push(window.setTimeout(then, ms));
  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };

  const finish = useCallback(() => {
    clearTimers();
    settled.current = true;
    setXp(final);
    setOrbXp(0);
    later(380, () => setPhase("items"));
  }, [final]);

  const collect = () => {
    if (phase !== "arrive" && phase !== "hold") return;
    clearTimers();
    setPhase("collect");
    if (hasOrb(variant)) return collectThroughTheOrb();
    let expected = 0;
    let landed = 0;
    const onLand = (share: number) => {
      addXp(share);
      landed += 1;
      if (landed === expected) finish();
    };
    cards.forEach((card, index) => {
      const element = cardElements.current.get(card.key);
      if (!element) return;
      const count = particlesFor(card.xp);
      expected += count;
      const spray = { count, xp: card.xp, target: toTheBar, onLand, delay: index * pace.collectStagger };
      if (variant === "F") crumble(element, spray);
      else poof(element, spray);
    });
    if (expected === 0) later(cards.length * pace.collectStagger + 600, finish);
    later(cards.length * pace.collectStagger + 3500, finish);
  };

  const collectThroughTheOrb = () => {
    const towards = orb.current ? centreOf(orb.current) : undefined;
    cards.forEach((card, index) => {
      const element = cardElements.current.get(card.key);
      const spray = { count: 0, xp: 0, target: toTheBar, onLand: () => {}, delay: index * pace.collectStagger };
      if (!element) return;
      if (variant === "E") poof(element, spray);
      else crumble(element, { ...spray, towards });
    });
    const launchAt = cards.length * pace.collectStagger + (variant === "E" ? 350 : 900);
    later(launchAt, () => {
      if (!orb.current) return finish();
      orb.current.dataset.launch = "";
      const count = 44;
      let landed = 0;
      const remaining = total;
      setOrbXp(remaining);
      stream(centreOf(orb.current), {
        count,
        xp: remaining,
        target: toTheBar,
        onLand: (share) => {
          addXp(share);
          addOrbXp(-share);
          landed += 1;
          if (landed === count) finish();
        },
      }, 700);
    });
    later(launchAt + 3500, finish);
  };

  const skip = () => {
    clearTimers();
    settled.current = true;
    clearParticles();
    setXp(final);
    setOrbXp(0);
    setPhase("items");
  };

  useEffect(() => {
    const own: number[] = [];
    const after = (ms: number, then: () => void) => own.push(window.setTimeout(then, ms));
    if (phase === "settle") after(pace.settle, () => setPhase(cards.length === 0 ? "items" : "arrive"));
    if (phase === "arrive") {
      after(arriveMs, () => setPhase("hold"));
      if (hasOrb(variant)) soakIntoTheOrb();
    }
    if (phase === "hold") after(holdMs, collect);
    return () => own.forEach((timer) => window.clearTimeout(timer));
  }, [phase]);

  const soakIntoTheOrb = () => {
    cards.forEach((card, index) => {
      later(index * pace.stagger + 500, () => {
        const element = cardElements.current.get(card.key);
        const chip = element?.querySelector<HTMLElement>(".xpm-chip");
        if (!element || !orb.current || !chip || card.xp === 0) return;
        chip.dataset.flown = "";
        const target = () => (orb.current ? centreOf(orb.current) : null);
        stream(centreOf(chip), { count: 8, xp: card.xp, target, onLand: addOrbXp }, 200);
      });
    });
  };

  useEffect(() => {
    if (closed !== "open") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (phase === "items") setClosed("later");
      else skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => () => clearParticles(), []);

  const level = levelFor(Math.round(xp));
  useLayoutEffect(() => onShown({ level, moving: false }), [level.xp, level.level]);
  useLevelPop(level.level, reduced);
  useSpotlight(closed === "open");
  useEffect(() => publishLine(`${variant} · ${phase}${phase === "hold" ? ` ${Math.round(holdMs / 100) / 10}s` : ""} · ${cards.length} excerpts, ${moments} moments · XP ${Math.round(xp)} · level ${level.level} · last visit ${phase === "items" ? "moved" : `still ${scenario.lastVisit}`}${closed === "open" ? "" : ` · ${closed}`}`));

  if (closed === "board") return <HandoffBoard count={scenario.items} onClose={() => setClosed("later")} />;
  if (closed === "later") return null;
  const narrow = viewport.width < 640;
  const canCollect = phase === "arrive" || phase === "hold";
  return (
    <div className="xpm-canvas" style={{ top: viewport.top }} data-variant={variant} data-orb={hasOrb(variant) ? "" : undefined} data-phase={phase} data-narrow={narrow ? "" : undefined} data-reduced={reduced ? "" : undefined} onClick={canCollect ? collect : undefined} role="dialog" aria-label="Since your last visit">
      {phase !== "items" &&
        cards.map((card, index) => {
          const spot = placed[index]!;
          const style = { left: spot.x, top: spot.y, width: spot.width, "--rot": `${spot.rot}deg`, "--d": `${index * pace.stagger}ms`, "--from-x": `${viewport.width / 2 - spot.x}px`, "--from-y": `${viewport.height / 2 - spot.y}px` } as CSSProperties;
          return (
            <div key={card.key} className="xpm-scatter-card" style={style}>
              <div
                className="xpm-scatter-inner"
                ref={(element) => {
                  if (element) cardElements.current.set(card.key, element);
                  else cardElements.current.delete(card.key);
                }}
              >
                {card.node(narrow)}
              </div>
            </div>
          );
        })}
      {variant === "D" && canCollect && <DrainCue holdMs={holdMs} running={phase === "hold"} />}
      {hasOrb(variant) && phase !== "items" && <Orb orb={orb} xp={orbXp} holdMs={holdMs} phase={phase} narrow={narrow} viewport={viewport} />}
      {variant === "F" && canCollect && <BarGhost from={scenario.startXp} to={final} holdMs={holdMs} running={phase === "hold"} />}
      {phase !== "items" && phase !== "collect" && (
        <button type="button" className="xpm-canvas-skip" onClick={(event) => (event.stopPropagation(), skip())}>
          Skip
        </button>
      )}
      {phase === "items" && <ItemsScene variant={variant} count={scenario.items} xp={total} moments={moments} lastVisit={scenario.lastVisit} onTurn={() => setClosed("board")} onLater={() => setClosed("later")} />}
    </div>
  );
}

function cardsOf(scenario: Scenario, me: string): Card[] {
  const cards: Card[] = scenario.excerpts.map((excerpt, index) => ({ key: index, xp: excerpt.xp, moments: excerpt.kind === "level" ? 0 : 1, node: (compact) => <ExcerptCard excerpt={excerpt} me={me} chip={noChip} compact={compact} /> }));
  const folded = scenario.folded;
  if (folded) cards.push({ key: cards.length, xp: folded.xp, moments: folded.count, node: () => <FoldLine beat={{ kind: "fold", ...folded }} chip={noChip} /> });
  return cards;
}

function levelFor(xp: number): AlbumLevel {
  const level = levelOf(xp);
  return { level, xp, startsAt: xpToReach(level), nextAt: xpToReach(level + 1) };
}

function useBatchedAdd(set: (update: (value: number) => number) => void, settled: { current: boolean }) {
  const pending = useRef(0);
  const frame = useRef<number | null>(null);
  return useCallback(
    (amount: number) => {
      pending.current += amount;
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        const add = pending.current;
        pending.current = 0;
        frame.current = null;
        if (!settled.current) set((value) => value + add);
      });
    },
    [set, settled],
  );
}

function useLevelPop(level: number, reduced: boolean) {
  const before = useRef(level);
  useEffect(() => {
    if (level > before.current && !reduced) popTheLevel();
    before.current = level;
  }, [level, reduced]);
}

function useSpotlight(on: boolean) {
  useEffect(() => {
    if (!on) return;
    document.documentElement.classList.add("xpm-spotlight");
    return () => document.documentElement.classList.remove("xpm-spotlight");
  }, [on]);
}

type Viewport = { width: number; height: number; top: number };

function topBarBottom() {
  return document.querySelector(".al-top")?.getBoundingClientRect().bottom ?? 56;
}

function useViewport(): Viewport {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight, top: topBarBottom() });
  useLayoutEffect(() => setSize({ width: window.innerWidth, height: window.innerHeight, top: topBarBottom() }), []);
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight, top: topBarBottom() });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

function jitter(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function layoutOf(variant: ScatterVariant, count: number, { width, height, top: barBottom }: Viewport): Placed[] {
  const narrow = width < 640;
  const top = barBottom + 24;
  const bottom = height - (narrow ? 150 : 120);
  const left = 16;
  const right = width - 16;
  if (hasOrb(variant) && !narrow) return ringOf(count, { top, bottom, left, right }, variant);
  const area = hasOrb(variant) ? { top, bottom: bottom - 150, left, right } : { top, bottom, left, right };
  const columns = narrow ? Math.min(2, count) : count <= 2 ? count : count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / columns);
  const cellWidth = (area.right - area.left) / Math.max(1, columns);
  const tidy = variant === "F";
  const cellHeight = tidy ? Math.min((area.bottom - area.top) / rows, narrow ? 200 : 210) : (area.bottom - area.top) / rows;
  const blockTop = area.top + ((area.bottom - area.top) - cellHeight * rows) / 2;
  const cardWidth = Math.min(narrow ? 178 : 330, cellWidth * (tidy ? 0.92 : 0.86));
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const inRow = Math.min(columns, count - row * columns);
    const offset = ((columns - inRow) * cellWidth) / 2;
    const jx = tidy ? 0 : jitter(index, 1) * cellWidth * 0.13;
    const jy = tidy ? 0 : jitter(index, 2) * cellHeight * 0.16;
    return { x: area.left + offset + (column + 0.5) * cellWidth + jx, y: blockTop + (row + 0.5) * cellHeight + jy, rot: tidy ? 0 : jitter(index, 3) * 5, width: cardWidth };
  });
}

const rings = {
  E: { width: 310, rx: null, ry: null, tilt: 2, wobble: 0 },
  G: { width: 290, rx: 300, ry: 185, tilt: 7, wobble: 0.16 },
  H: { width: 280, rx: 235, ry: 150, tilt: 11, wobble: 0.28 },
} as const;

function ringOf(count: number, area: { top: number; bottom: number; left: number; right: number }, variant: ScatterVariant): Placed[] {
  const ring = rings[variant as keyof typeof rings] ?? rings.E;
  const cx = (area.left + area.right) / 2;
  const cy = (area.top + area.bottom) / 2;
  const widest = (area.right - area.left) / 2 - ring.width / 2 - 8;
  const tallest = (area.bottom - area.top) / 2 - 70;
  const rx = Math.min(ring.rx ?? widest, widest);
  const ry = Math.min(ring.ry ?? tallest, tallest);
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2 + (count % 2 === 0 ? Math.PI / count : 0) + jitter(index, 5) * ring.wobble;
    const reach = 1 + jitter(index, 6) * ring.wobble * 0.5;
    return { x: cx + Math.cos(angle) * rx * reach, y: cy + Math.sin(angle) * ry * reach, rot: jitter(index, 3) * ring.tilt, width: ring.width };
  });
}

function DrainCue({ holdMs, running }: { holdMs: number; running: boolean }) {
  return (
    <>
      <div className="xpm-drain" data-running={running ? "" : undefined} style={{ "--hold": `${holdMs}ms` } as CSSProperties} />
      <p className="xpm-collect-hint">Click anywhere to collect your XP</p>
    </>
  );
}

function Orb({ orb, xp, holdMs, phase, narrow, viewport }: { orb: React.RefObject<HTMLDivElement | null>; xp: number; holdMs: number; phase: Phase; narrow: boolean; viewport: Viewport }) {
  const style = narrow ? ({ left: viewport.width / 2, top: viewport.height - 150 - 75 } as CSSProperties) : ({ left: viewport.width / 2, top: (80 + viewport.height - 120) / 2 } as CSSProperties);
  return (
    <div ref={orb} className="xpm-orb" data-phase={phase} style={style}>
      <svg className="xpm-orb-ring" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="56" pathLength={100} style={{ "--hold": `${holdMs}ms` } as CSSProperties} />
      </svg>
      <span className="xpm-orb-xp">+{Math.max(0, Math.round(xp))}</span>
      <span className="xpm-orb-unit">XP</span>
      {(phase === "arrive" || phase === "hold") && <span className="xpm-orb-hint">Tap to collect</span>}
    </div>
  );
}

function BarGhost({ from, to, holdMs, running }: { from: number; to: number; holdMs: number; running: boolean }) {
  const [box, setBox] = useState<DOMRect | null>(null);
  const [left, setLeft] = useState(Math.ceil(holdMs / 1000));
  useLayoutEffect(() => setBox(document.querySelector(".al-xp-track")?.getBoundingClientRect() ?? null), []);
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const tick = window.setInterval(() => setLeft(Math.max(0, Math.ceil((holdMs - (Date.now() - started)) / 1000))), 200);
    return () => window.clearInterval(tick);
  }, [running, holdMs]);
  if (!box) return null;
  const level = levelOf(from);
  const shareOf = (xp: number) => Math.min(1, Math.max(0, (xp - xpToReach(level)) / (xpToReach(level + 1) - xpToReach(level))));
  const start = shareOf(from);
  const end = shareOf(to);
  const levelsUp = levelOf(to) - level;
  return (
    <>
      <span className="xpm-bar-ghost" style={{ left: box.left + start * box.width, top: box.top, width: Math.max(4, (end - start) * box.width), height: box.height }} />
      <p className="xpm-bar-caption" style={{ left: box.left - 70, top: "calc(var(--al-top-height) + 0.75rem)" }}>
        <strong>+{to - from} XP</strong> on its way{levelsUp > 0 ? ` · level ${level + levelsUp}!` : ""}
        <span className="xpm-bar-countdown">{running ? `collecting in ${left}` : "…"}</span>
        <span className="xpm-bar-caption-hint">or click anywhere</span>
      </p>
    </>
  );
}

function ItemsScene({ variant, count, xp, moments, lastVisit, onTurn, onLater }: { variant: ScatterVariant; count: number; xp: number; moments: number; lastVisit: string; onTurn: () => void; onLater: () => void }) {
  useEffect(() => {
    if (count > 0) return;
    const leave = window.setTimeout(onLater, 2600);
    return () => window.clearTimeout(leave);
  }, [count, onLater]);
  return (
    <div className="xpm-items-scene" data-variant={variant}>
      {xp > 0 && (
        <p className="xpm-collected">
          <strong>+{xp} XP</strong> from {moments} {moments === 1 ? "moment" : "moments"} since {lastVisit}
        </p>
      )}
      <p className="xpm-items-big">{count === 0 ? "All caught up" : itemsWords(count)}</p>
      {count > 0 && (
        <>
          <div className="xpm-items-row">
            {Array.from({ length: count }, (_, index) => (
              <button key={index} type="button" className="xpm-item" style={{ "--i": index, "--tilt": `${jitter(index, 7) * 8}deg`, "--lift": `${jitter(index, 8) * 18}px` } as CSSProperties} onClick={onTurn} aria-label={`Turn over item ${index + 1}`} autoFocus={index === 0}>
                <span aria-hidden="true">?</span>
              </button>
            ))}
          </div>
          <p className="xpm-items-sub">Pick one to turn it over</p>
          <a
            href="#later"
            className="xpm-later"
            onClick={(event) => {
              event.preventDefault();
              onLater();
            }}
          >
            Later
          </a>
        </>
      )}
    </div>
  );
}
