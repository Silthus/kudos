// PROTOTYPE (#625): the open book at the centre of the HUD: a fixed-size spread, chapter ribbons and a page-curl turn. Never merge to main.
import { useEffect, useState, type ReactNode } from "react";
import { HedgehogReading } from "../../hoggies";
import { prefersReducedMotion } from "../../reducedMotion";
import { chapterLabel, chapters, firstSpreadOf, type Chapter, type Spread } from "./spreads";

type Turn = { from: number; to: number };

const turnMs = 360;

const ribbonColour: Record<Chapter, string> = {
  common: "var(--rarity-common)",
  uncommon: "var(--rarity-uncommon)",
  rare: "var(--rarity-rare)",
  epic: "var(--rarity-epic)",
  legendary: "var(--rarity-legendary)",
  teams: "#1d4aff",
  achievements: "#9a6b00",
  store: "#b83a00",
};

type BookProps = { spreads: Spread[]; index: number; onFlip(index: number): void; onChapter(href: string): void };

export function Book({ spreads, index, onFlip, onChapter }: BookProps) {
  const turn = useTurn(index);
  const current = spreads[index]!;
  return (
    <div className="v1-book-wrap">
      <Ribbons spreads={spreads} active={current.chapter} onChapter={onChapter} />
      <section className="v1-book" aria-label="Your collection book" data-v1-book>
        <Spine />
        {turn === null ? <StillSpread spread={current} /> : <TurningSpread spreads={spreads} turn={turn} />}
        <PageButtons index={index} count={spreads.length} onFlip={onFlip} />
      </section>
    </div>
  );
}

function useTurn(index: number) {
  const [shown, setShown] = useState(index);
  const [turn, setTurn] = useState<Turn | null>(null);
  if (index !== shown) {
    setShown(index);
    setTurn(prefersReducedMotion() ? null : { from: shown, to: index });
  }
  useEffect(() => {
    if (turn === null) return;
    const timer = window.setTimeout(() => setTurn(null), turnMs);
    return () => window.clearTimeout(timer);
  }, [turn]);
  return turn;
}

function StillSpread({ spread }: { spread: Spread }) {
  return (
    <>
      <PageSide side="left">{spread.left}</PageSide>
      <PageSide side="right">{spread.right}</PageSide>
    </>
  );
}

function TurningSpread({ spreads, turn }: { spreads: Spread[]; turn: Turn }) {
  const from = spreads[turn.from]!;
  const to = spreads[turn.to]!;
  const forward = turn.to > turn.from;
  return (
    <>
      <PageSide side="left">{forward ? from.left : to.left}</PageSide>
      <PageSide side="right">{forward ? to.right : from.right}</PageSide>
      <div key={`${turn.from}-${turn.to}`} className={`v1-leaf ${forward ? "v1-leaf-forward" : "v1-leaf-back"}`} aria-hidden="true">
        <div className="v1-leaf-face v1-leaf-front">{forward ? from.right : from.left}</div>
        <div className="v1-leaf-face v1-leaf-back-face">{forward ? to.left : to.right}</div>
      </div>
    </>
  );
}

function PageSide({ side, children }: { side: "left" | "right"; children: ReactNode }) {
  return <div className={`v1-page v1-page-${side}`}>{children}</div>;
}

function Spine() {
  return <div className="v1-spine" aria-hidden="true" />;
}

function PageButtons({ index, count, onFlip }: { index: number; count: number; onFlip(index: number): void }) {
  return (
    <div className="v1-page-buttons">
      <button type="button" className="v1-corner v1-corner-left" disabled={index === 0} onClick={() => onFlip(index - 1)} aria-label="Previous pages" title="Previous pages (←)">
        ‹
      </button>
      <span className="v1-spread-count">
        {index + 1} / {count}
      </span>
      <button type="button" className="v1-corner v1-corner-right" disabled={index === count - 1} onClick={() => onFlip(index + 1)} aria-label="Next pages" title="Next pages (→)">
        ›
      </button>
    </div>
  );
}

function Ribbons({ spreads, active, onChapter }: { spreads: Spread[]; active: Chapter; onChapter(href: string): void }) {
  return (
    <nav className="v1-ribbons" aria-label="Chapters">
      {chapters.map((chapter) => (
        <button key={chapter} type="button" className={`v1-ribbon ${chapter === active ? "v1-ribbon-active" : ""}`} style={{ background: ribbonColour[chapter] }} aria-current={chapter === active ? "page" : undefined} onClick={() => onChapter(firstSpreadOf(spreads, chapter))}>
          {chapterLabel[chapter]}
        </button>
      ))}
    </nav>
  );
}

export function ClosedBook({ name, level, owned, total, onOpen }: { name: string; level: number; owned: number; total: number; onOpen(): void }) {
  const [opening, setOpening] = useState(false);
  const open = () => {
    if (prefersReducedMotion()) return onOpen();
    setOpening(true);
    window.setTimeout(onOpen, 620);
  };
  return (
    <div className={`v1-closed ${opening ? "v1-closed-opening" : ""}`}>
      <div className="v1-closed-under" aria-hidden="true" />
      <button type="button" className="v1-cover" onClick={open} aria-label="Open your book">
        <span className="v1-cover-frame">
          <span className="v1-cover-kicker">The hoggie book of</span>
          <span className="v1-cover-title">{name}</span>
          <HedgehogReading size={190} className="v1-cover-art" />
          <span className="v1-cover-level">Level {level}</span>
          <span className="v1-cover-count">
            {owned} / {total} hoggies
          </span>
          <span className="v1-cover-cta">Open the book</span>
        </span>
      </button>
    </div>
  );
}
