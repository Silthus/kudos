// PROTOTYPE (#625): the sticker album in the middle of the desk: a closed cover, then a fixed-size spread whose pages turn like paper.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { HedgehogParty } from "../../hoggies";
import { rarityColour, type World } from "../world";
import { AlbumPageView } from "./AlbumPage";
import type { AlbumPage, Spread } from "./albumPages";
import { useReducedMotion } from "./motion";

const turnMs = 560;

const openMs = 700;

type AlbumProps = {
  world: World;
  spreads: Spread[];
  open: boolean;
  target: number;
  keysActive: boolean;
  justStuck: string | null;
  onOpen: () => void;
  onClose: () => void;
  onFlipTo: (index: number) => void;
};

export function Album({ world, spreads, open, target, keysActive, justStuck, onOpen, onClose, onFlipTo }: AlbumProps) {
  const opening = useOpening(open);
  return (
    <section className={`v5-album ${open ? "v5-album-open" : "v5-album-closed"} ${opening ? "v5-album-opening" : ""}`} aria-label="Sticker album">
      <div className="v5-album-book">
        {open ? <OpenAlbum world={world} spreads={spreads} target={target} keysActive={keysActive} justStuck={justStuck} onClose={onClose} onFlipTo={onFlipTo} /> : <ClosedCover world={world} onOpen={onOpen} />}
        {opening && <CoverLeaf world={world} />}
      </div>
    </section>
  );
}

function useOpening(open: boolean) {
  const reduced = useReducedMotion();
  const wasOpen = useRef(open);
  const [opening, setOpening] = useState(false);
  useLayoutEffect(() => {
    if (open && !wasOpen.current && !reduced) setOpening(true);
    wasOpen.current = open;
  }, [open, reduced]);
  useEffect(() => {
    if (!opening) return;
    const done = window.setTimeout(() => setOpening(false), openMs);
    return () => window.clearTimeout(done);
  }, [opening]);
  return opening;
}

function ClosedCover({ world, onOpen }: { world: World; onOpen: () => void }) {
  return (
    <button type="button" className="v5-cover" onClick={onOpen} aria-label="Open the sticker album">
      <CoverArt world={world} />
    </button>
  );
}

function CoverLeaf({ world }: { world: World }) {
  return (
    <div className="v5-cover-leaf" aria-hidden="true">
      <div className="v5-leaf-face v5-leaf-front v5-cover">
        <CoverArt world={world} />
      </div>
      <div className="v5-leaf-face v5-leaf-back v5-cover-inside" />
    </div>
  );
}

function CoverArt({ world }: { world: World }) {
  return (
    <>
      <span className="v5-cover-title">HedgeHug</span>
      <span className="v5-cover-subtitle">Sticker album 2026</span>
      <span className="v5-cover-hog">
        <HedgehogParty size={190} />
      </span>
      <span className="v5-cover-name">
        <span className="v5-print-small">This album belongs to</span>
        {world.me.name}
      </span>
      <span className="v5-cover-count">
        {world.owned}/{world.total} stickers
      </span>
      <span className="v5-cover-cta">Open the album</span>
    </>
  );
}

type Turn = { from: number; to: number };

function useTurns(target: number) {
  const reduced = useReducedMotion();
  const [settled, setSettled] = useState(target);
  const [turn, setTurn] = useState<Turn | null>(null);
  useLayoutEffect(() => {
    if (turn !== null || target === settled) return;
    if (reduced) setSettled(target);
    else setTurn({ from: settled, to: target });
  }, [target, settled, turn, reduced]);
  useEffect(() => {
    if (turn === null) return;
    const done = window.setTimeout(() => {
      setSettled(turn.to);
      setTurn(null);
    }, turnMs);
    return () => window.clearTimeout(done);
  }, [turn]);
  return { settled, turn };
}

type OpenAlbumProps = Omit<AlbumProps, "open" | "onOpen">;

function OpenAlbum({ world, spreads, target, keysActive, justStuck, onClose, onFlipTo }: OpenAlbumProps) {
  const { settled, turn } = useTurns(target);
  const page = (album: AlbumPage) => <AlbumPageView page={album} world={world} spreads={spreads} justStuck={justStuck} onGoTo={(id) => onFlipTo(spreads.findIndex((spread) => spread.id === id))} />;
  const flip = (by: number) => onFlipTo(Math.min(spreads.length - 1, Math.max(0, target + by)));
  useArrowKeys(keysActive, flip);
  const shown = spreads[settled]!;
  const forward = turn !== null && turn.to > turn.from;
  const left = turn === null ? shown.left : forward ? spreads[turn.from]!.left : spreads[turn.to]!.left;
  const right = turn === null ? shown.right : forward ? spreads[turn.to]!.right : spreads[turn.from]!.right;
  return (
    <>
      <div className="v5-spread" data-spread={shown.id}>
        <PageSide side="left">{page(left)}</PageSide>
        <PageSide side="right">{page(right)}</PageSide>
        <div className="v5-spine" />
        {turn !== null && <Leaf forward={forward} front={page(forward ? spreads[turn.from]!.right : spreads[turn.from]!.left)} back={page(forward ? spreads[turn.to]!.left : spreads[turn.to]!.right)} />}
        <PageCorner side="left" disabled={target === 0} onClick={() => flip(-1)} />
        <PageCorner side="right" disabled={target === spreads.length - 1} onClick={() => flip(1)} />
        <span className="v5-folio v5-folio-left">{target * 2 + 1}</span>
        <span className="v5-folio v5-folio-right">{target * 2 + 2}</span>
      </div>
      <SectionTabs world={world} spreads={spreads} current={spreads[target]!.section} onFlipTo={onFlipTo} />
      <button type="button" className="v5-close-album" onClick={onClose}>
        Close album
      </button>
    </>
  );
}

function useArrowKeys(active: boolean, flip: (by: number) => void) {
  const latest = useRef(flip);
  latest.current = flip;
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.matches("input, textarea, select")) return;
      if (event.key === "ArrowLeft") latest.current(-1);
      if (event.key === "ArrowRight") latest.current(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
}

function PageSide({ side, children }: { side: "left" | "right"; children: ReactNode }) {
  return <div className={`v5-page v5-page-${side}`}>{children}</div>;
}

function Leaf({ forward, front, back }: { forward: boolean; front: ReactNode; back: ReactNode }) {
  return (
    <div className={`v5-leaf ${forward ? "v5-leaf-forward" : "v5-leaf-backward"}`} style={{ "--turn-ms": `${turnMs}ms` } as CSSProperties} aria-hidden="true">
      <div className="v5-leaf-face v5-leaf-front v5-page">{front}</div>
      <div className="v5-leaf-face v5-leaf-back v5-page">{back}</div>
    </div>
  );
}

function PageCorner({ side, disabled, onClick }: { side: "left" | "right"; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`v5-corner v5-corner-${side}`} disabled={disabled} onClick={onClick} aria-label={side === "left" ? "Previous page" : "Next page"}>
      <span>{side === "left" ? "‹" : "›"}</span>
    </button>
  );
}

function SectionTabs({ world, spreads, current, onFlipTo }: { world: World; spreads: Spread[]; current: string; onFlipTo: (index: number) => void }) {
  const tabs = [{ section: "contents", label: "Contents", colour: "#23251d" }, ...world.rarities.map(({ rarity }) => ({ section: rarity, label: rarity, colour: rarityColour[rarity] })), { section: "teams", label: "Teams", colour: "#F54E00" }];
  return (
    <nav className="v5-tabs" aria-label="Album sections">
      {tabs.map(({ section, label, colour }) => (
        <button key={section} type="button" className={`v5-tab ${current === section ? "v5-tab-current" : ""}`} style={{ "--tab": colour } as CSSProperties} aria-current={current === section ? "page" : undefined} onClick={() => onFlipTo(spreads.findIndex((spread) => spread.section === section))}>
          {label}
        </button>
      ))}
    </nav>
  );
}
