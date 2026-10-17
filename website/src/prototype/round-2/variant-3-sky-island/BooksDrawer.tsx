// PROTOTYPE (#625): the left drawer: two fixed-size books (Hoggies, Teams) with an index, fore-edge tabs, ribbons and page turns. Never merge to main.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { prefersReducedMotion } from "../../../reducedMotion";
import { CrestArt } from "../../art";
import { rarityColour, type World } from "../../world";
import { BookPageView } from "./BookPages";
import { bookOfHash, pageIndexAt, pagesOf, type BookId, type BookPage } from "./books";
import { rarityLabel } from "./looks";
import { isTyping } from "./navigation";

type Props = { world: World; open: boolean; hash: string; spotlight: string | null; arrowKeys: boolean; onToggle: () => void; onFlip: (hash: string) => void; onClose: () => void };

type Turn = { way: "forward" | "back"; serial: number };

const lastHashOf: Record<BookId, string> = { hoggies: "#hoggies", teams: "#teams" };

export function BooksDrawer({ world, open, hash, spotlight, arrowKeys, onToggle, onFlip, onClose }: Props) {
  const book = bookOfHash(hash) ?? "hoggies";
  const pages = pagesOf(book, world);
  const index = pageIndexAt(pages, hash);
  const page = pages[index]!;
  lastHashOf[book] = page.hash;
  const turn = usePageTurn(book, index);
  const flipTo = (next: number) => {
    const target = pages[next];
    if (target !== undefined) onFlip(target.hash);
  };
  useArrowKeys(arrowKeys, () => flipTo(index - 1), () => flipTo(index + 1));
  return (
    <aside className="sk-drawer sk-drawer-left" data-open={open || undefined} aria-label="Books">
      <button type="button" className="sk-pull sk-pull-left" onClick={onToggle} aria-expanded={open} aria-keyshortcuts="B">
        <BookIcon />
        <span>Books</span>
      </button>
      <div className="sk-drawer-body" inert={!open}>
        <div className="sk-shelf">
          <BookSpine id="hoggies" label="Hoggies" sub={`${world.owned}/${world.total}`} active={book === "hoggies"} onPick={() => onFlip(lastHashOf.hoggies)} />
          <BookSpine id="teams" label="Teams" sub={`${world.teams.filter((team) => team.complete).length}/${world.teams.length} complete`} active={book === "teams"} onPick={() => onFlip(lastHashOf.teams)} />
          <button type="button" className="sk-drawer-close" onClick={onClose} aria-label="Close the books">
            ✕
          </button>
        </div>
        <div key={book} className={`sk-book sk-book-${book}`}>
          <Ribbons book={book} world={world} pages={pages} current={page} onFlip={onFlip} />
          <div className="sk-book-block">
            <article className="sk-book-page" aria-label={`Page ${index + 1} of ${pages.length}`}>
              <BookPageView page={page} pages={pages} world={world} spotlight={spotlight} onFlip={onFlip} />
              <footer className="sk-book-foot">
                <button type="button" className="sk-flip" onClick={() => flipTo(index - 1)} disabled={index === 0} aria-label="Previous page">
                  ◀
                </button>
                <span className="sk-folio">
                  p. {index + 1} / {pages.length} <small>← → to turn</small>
                </span>
                <button type="button" className="sk-flip" onClick={() => flipTo(index + 1)} disabled={index === pages.length - 1} aria-label="Next page">
                  ▶
                </button>
              </footer>
            </article>
            {turn !== null && <span key={turn.serial} className={`sk-leaf sk-leaf-${turn.way}`} aria-hidden="true" />}
            <span className="sk-cover-opening" aria-hidden="true" />
          </div>
          <EdgeTabs book={book} world={world} pages={pages} current={page} onFlip={onFlip} />
        </div>
      </div>
    </aside>
  );
}

function useArrowKeys(on: boolean, onBack: () => void, onForward: () => void) {
  const handlers = useRef({ onBack, onForward });
  handlers.current = { onBack, onForward };
  useEffect(() => {
    if (!on) return;
    const listen = (event: KeyboardEvent) => {
      if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) return;
      if (event.key === "ArrowLeft") handlers.current.onBack();
      else if (event.key === "ArrowRight") handlers.current.onForward();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", listen);
    return () => window.removeEventListener("keydown", listen);
  }, [on]);
}

function usePageTurn(book: BookId, index: number) {
  const [turn, setTurn] = useState<Turn | null>(null);
  const previous = useRef({ book, index });
  useEffect(() => {
    const before = previous.current;
    previous.current = { book, index };
    if (before.book !== book || before.index === index || prefersReducedMotion()) return;
    setTurn((current) => ({ way: index > before.index ? "forward" : "back", serial: (current?.serial ?? 0) + 1 }));
  }, [book, index]);
  useEffect(() => {
    if (turn === null) return;
    const timer = window.setTimeout(() => setTurn(null), 650);
    return () => window.clearTimeout(timer);
  }, [turn]);
  return turn;
}

function BookSpine({ id, label, sub, active, onPick }: { id: BookId; label: string; sub: string; active: boolean; onPick: () => void }) {
  return (
    <button type="button" className={`sk-spine sk-spine-${id}`} aria-pressed={active} onClick={onPick}>
      <span className="sk-spine-label">{label}</span>
      <span className="sk-spine-sub">{sub}</span>
    </button>
  );
}

type Tab = { key: string; label: string; colour: string; hash: string; crest?: ReactNode };

function tabsOf(book: BookId, world: World): Tab[] {
  const index: Tab = { key: "index", label: "Index", colour: "#6b5a3a", hash: `#${book}` };
  if (book === "hoggies") return [index, ...world.rarities.map(({ rarity }) => ({ key: rarity, label: rarityLabel[rarity], colour: rarityColour[rarity], hash: `#hoggies/${rarity}/1` }))];
  return [index, ...world.teams.map((team) => ({ key: team.team, label: team.name, colour: team.mine ? "#1f8a3b" : "#3d6fa8", hash: `#teams/${team.team}`, crest: <CrestArt art={team.art} size={18} name={team.name} collected={team.complete || team.crest !== null} /> }))];
}

function EdgeTabs({ book, world, current, onFlip }: { book: BookId; world: World; pages: BookPage[]; current: BookPage; onFlip: (hash: string) => void }) {
  return (
    <nav className="sk-edge-tabs" aria-label="Chapters">
      {tabsOf(book, world).map((tab) => (
        <button key={tab.key} type="button" className="sk-edge-tab" aria-current={current.chapter === tab.key} style={{ "--tab": tab.colour } as CSSProperties} onClick={() => onFlip(tab.hash)} title={tab.label}>
          {tab.crest}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

function Ribbons({ book, world, current, onFlip }: { book: BookId; world: World; pages: BookPage[]; current: BookPage; onFlip: (hash: string) => void }) {
  const ribbons = ribbonsOf(book, world);
  return (
    <div className="sk-ribbons">
      {ribbons.map((ribbon) => (
        <button key={ribbon.label} type="button" className="sk-ribbon" aria-current={current.hash === ribbon.hash} style={{ "--ribbon": ribbon.colour } as CSSProperties} onClick={() => onFlip(ribbon.hash)} title={`Ribbon: ${ribbon.label}`}>
          <span>{ribbon.label}</span>
        </button>
      ))}
    </div>
  );
}

function ribbonsOf(book: BookId, world: World) {
  if (book === "hoggies") {
    const latest = world.hoggies.filter(({ firstAt }) => firstAt !== null).toSorted((first, second) => (second.firstAt ?? 0) - (first.firstAt ?? 0))[0];
    const latestHash = latest === undefined ? "#hoggies" : (pagesOf("hoggies", world).find((page) => page.kind === "hoggies" && page.hoggies.includes(latest))?.hash ?? "#hoggies");
    return [
      { label: "Index", hash: "#hoggies", colour: "#c0392b" },
      { label: "Newest", hash: latestHash, colour: "#f7a501" },
    ];
  }
  const mine = world.teams.find(({ mine }) => mine);
  return [
    { label: "Index", hash: "#teams", colour: "#c0392b" },
    { label: "My team", hash: mine === undefined ? "#teams" : `#teams/${mine.team}`, colour: "#1f8a3b" },
  ];
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5a1.5 1.5 0 0 0 0 3H20v1H6.5A2.5 2.5 0 0 1 4 19.5z" fill="currentColor" />
    </svg>
  );
}
