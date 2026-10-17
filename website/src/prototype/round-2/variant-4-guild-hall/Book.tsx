// PROTOTYPE (#625) round 2 variant 4: the books docked in the left zone: Hoggies and Teams as tabs of one frame, index first, chapter tabs and ribbons, fixed size. Never merge to main.
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { prefersReducedMotion } from "../../../reducedMotion";
import { HedgehogReading, HedgehogStar } from "../../../hoggies";
import type { CollectionHoggie, CollectionTeamPerson } from "../../../collectionRead";
import { CrestArt, HoggieArt, MemberFace } from "../../art";
import { rarityColour, rarityOrder, type World } from "../../world";
import { replaceHash, type BookId } from "./address";
import { Meter } from "./bits";
import { pageNumberOf, spreadIndexAt, spreadsOf, type Page, type Spread } from "./books";
import { bannerColours } from "./Hall";

type Turn = { way: "forward" | "back"; serial: number };

type BookProps = { book: BookId; world: World; spotlight: string | null; listening: boolean; onBook(book: BookId): void; onClose(): void; onFlipped(): void };

const bookTitle: Record<BookId, string> = { hoggies: "Hoggies", teams: "Teams" };

export function DockedBook({ book, world, spotlight, listening, onBook, onClose, onFlipped }: BookProps) {
  const spreads = spreadsOf(book, world);
  const index = spreadIndexAt(spreads, window.location.hash);
  const spread = spreads[index]!;
  const [turn, setTurn] = useState<Turn | null>(null);

  const goTo = useCallback(
    (next: number) => {
      const target = spreads[Math.min(spreads.length - 1, Math.max(0, next))];
      if (target === undefined || target.hash === spread.hash) return;
      replaceHash(target.hash);
      if (!prefersReducedMotion()) setTurn((current) => ({ way: next > index ? "forward" : "back", serial: (current?.serial ?? 0) + 1 }));
      onFlipped();
    },
    [spreads, spread.hash, index, onFlipped],
  );
  const goToHash = (hash: string) => goTo(spreadIndexAt(spreads, hash));

  useEffect(() => {
    if (!listening) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowRight") goTo(index + 1);
      else if (event.key === "ArrowLeft") goTo(index - 1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listening, goTo, index]);

  return (
    <section className={`gh-dock-frame gh-book-frame gh-book-${book}`} aria-label={bookTitle[book]}>
      <DockTabs
        tabs={(["hoggies", "teams"] as const).map((id) => ({ id, label: bookTitle[id] }))}
        active={book}
        onTab={(id) => onBook(id as BookId)}
        onClose={onClose}
      />
      <div className="gh-book" key={book}>
        <span className="gh-book-cover-back" aria-hidden="true" />
        <div className="gh-book-pages">
          <article className="gh-page gh-page-left">
            <PageView page={spread.left} world={world} spreads={spreads} spotlight={spotlight} onGo={goToHash} />
            <span className="gh-folio">{index * 2 + 1}</span>
          </article>
          <article className="gh-page gh-page-right">
            <PageView page={spread.right} world={world} spreads={spreads} spotlight={spotlight} onGo={goToHash} />
            <span className="gh-folio">{index * 2 + 2}</span>
          </article>
          <span className="gh-spine" aria-hidden="true" />
          {turn !== null && <span key={turn.serial} className={`gh-leaf gh-leaf-${turn.way}`} aria-hidden="true" onAnimationEnd={() => setTurn(null)} />}
          <span className="gh-cover-opening" aria-hidden="true" />
        </div>
        <ChapterTabs book={book} world={world} spreads={spreads} current={spread} onGo={goToHash} />
        <Ribbons book={book} world={world} spreads={spreads} onGo={goToHash} />
        <footer className="gh-book-foot">
          <button type="button" className="gh-flip" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous page">
            ◀
          </button>
          <span>
            Spread {index + 1} of {spreads.length} · ←/→ to turn
          </span>
          <button type="button" className="gh-flip" onClick={() => goTo(index + 1)} disabled={index === spreads.length - 1} aria-label="Next page">
            ▶
          </button>
        </footer>
      </div>
    </section>
  );
}

export function DockTabs({ tabs, active, onTab, onClose, onCloseTab }: { tabs: { id: string; label: string }[]; active: string; onTab(id: string): void; onClose(): void; onCloseTab?: (id: string) => void }) {
  return (
    <header className="gh-dock-tabs">
      <div role="tablist" className="gh-dock-tablist">
        {tabs.map((tab) => (
          <span key={tab.id} className={`gh-dock-tab ${tab.id === active ? "gh-dock-tab-on" : ""}`}>
            <button type="button" role="tab" aria-selected={tab.id === active} onClick={() => onTab(tab.id)}>
              {tab.label}
            </button>
            {onCloseTab !== undefined && tabs.length > 1 && (
              <button type="button" className="gh-dock-tab-x" onClick={() => onCloseTab(tab.id)} aria-label={`Close the ${tab.label} tab`}>
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      <button type="button" className="gh-dock-close" onClick={onClose} aria-label="Close this panel" title="Close (Esc)">
        ✕
      </button>
    </header>
  );
}

type Chapter = { hash: string; label: string; colour: string; art?: ReactNode };

function chaptersOf(book: BookId, world: World): Chapter[] {
  if (book === "hoggies") return [{ hash: "#hoggies", label: "Index", colour: "#7a5a1e" }, ...rarityOrder.map((rarity) => ({ hash: `#hoggies/${rarity}`, label: rarity, colour: rarityColour[rarity] }))];
  return [{ hash: "#teams", label: "Index", colour: "#7a5a1e" }, ...world.teams.map((team, index) => ({ hash: `#teams/${team.team}`, label: team.name, colour: bannerColours[index % bannerColours.length]!, art: <CrestArt art={team.art} size={20} name={team.name} collected={team.complete || team.crest !== null} /> }))];
}

function ChapterTabs({ book, world, spreads, current, onGo }: { book: BookId; world: World; spreads: Spread[]; current: Spread; onGo(hash: string): void }) {
  const chapters = chaptersOf(book, world);
  return (
    <nav className="gh-chapter-tabs" aria-label="Chapters">
      {chapters.map((chapter) => {
        const on = current.hash === chapter.hash || current.hash.startsWith(`${chapter.hash}/`) || (chapter.label !== "Index" && spreads[spreadIndexAt(spreads, chapter.hash)]?.chapter === current.chapter);
        return (
          <button key={chapter.hash} type="button" className={`gh-chapter-tab ${on ? "gh-chapter-on" : ""}`} style={{ "--chapter": chapter.colour } as CSSProperties} onClick={() => onGo(chapter.hash)} aria-current={on} title={chapter.label}>
            {chapter.art ?? <span className="gh-chapter-label">{chapter.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}

function Ribbons({ book, world, spreads, onGo }: { book: BookId; world: World; spreads: Spread[]; onGo(hash: string): void }) {
  const ribbons = ribbonsOf(book, world, spreads);
  return (
    <div className="gh-ribbons">
      {ribbons.map((ribbon) => (
        <button key={ribbon.label} type="button" className="gh-ribbon" style={{ "--ribbon": ribbon.colour } as CSSProperties} onClick={() => onGo(ribbon.hash)} title={`Ribbon: ${ribbon.label}`}>
          <span>{ribbon.label}</span>
        </button>
      ))}
    </div>
  );
}

function ribbonsOf(book: BookId, world: World, spreads: Spread[]) {
  if (book === "hoggies") {
    const latest = world.hoggies.filter(({ firstAt }) => firstAt !== null).toSorted((first, second) => (second.firstAt ?? 0) - (first.firstAt ?? 0))[0];
    const spread = latest === undefined ? undefined : spreads.find(({ left, right }) => [left, right].some((page) => page.kind === "hoggies" && page.hoggies.includes(latest)));
    return [{ label: "Latest find", hash: spread?.hash ?? "#hoggies", colour: "#F54E00" }, { label: "Legendary", hash: "#hoggies/legendary", colour: rarityColour.legendary }];
  }
  const mine = world.teams.find((team) => team.mine);
  const nearly = world.teams.filter((team) => !team.complete && team.total > 0).toSorted((first, second) => second.held / second.total - first.held / first.total)[0];
  return [
    { label: "Your team", hash: mine === undefined ? "#teams" : `#teams/${mine.team}`, colour: "#1D4AFF" },
    { label: "Nearly full", hash: nearly === undefined ? "#teams" : `#teams/${nearly.team}`, colour: "#2f9e44" },
  ];
}

type PageProps = { page: Page; world: World; spreads: Spread[]; spotlight: string | null; onGo(hash: string): void };

function PageView({ page, world, spreads, spotlight, onGo }: PageProps) {
  if (page.kind === "title") return page.book === "hoggies" ? <HoggiesTitle world={world} /> : <TeamsTitle world={world} />;
  if (page.kind === "contents") return page.book === "hoggies" ? <HoggiesContents world={world} spreads={spreads} onGo={onGo} /> : <TeamsContents world={world} spreads={spreads} onGo={onGo} />;
  if (page.kind === "hoggies") return <HoggiesPage page={page} spotlight={spotlight} />;
  if (page.kind === "team-cover") return <TeamCover page={page} />;
  if (page.kind === "team-people") return <TeamPeople page={page} />;
  return (
    <div className="gh-page-inner gh-chapter-end">
      <HedgehogReading size={110} />
      <p>{page.label}</p>
    </div>
  );
}

function HoggiesTitle({ world }: { world: World }) {
  return (
    <div className="gh-page-inner gh-title-page">
      <p className="gh-small-caps">The guild's book of</p>
      <h2 className="gh-title-big">Hoggies</h2>
      <HedgehogStar size={100} />
      <p className="gh-title-owner">kept by {world.me.name}</p>
      <p className="gh-title-total">
        <strong>{world.owned}</strong> of {world.total} found
      </p>
      <ul className="gh-tally">
        {world.rarities.map(({ rarity, owned, total }) => (
          <li key={rarity}>
            <span style={{ color: rarityColour[rarity] }}>{rarity}</span>
            <Meter value={owned} max={total} label={`${rarity} hoggies`} colour={rarityColour[rarity]} />
            <span>
              {owned}/{total}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HoggiesContents({ world, spreads, onGo }: { world: World; spreads: Spread[]; onGo(hash: string): void }) {
  return (
    <div className="gh-page-inner gh-contents">
      <h2 className="gh-page-title">Contents</h2>
      <ol>
        {world.rarities.map(({ rarity, owned, total }) => (
          <ContentsLine key={rarity} label={rarity} detail={`${owned}/${total}`} page={pageNumberOf(spreads, `#hoggies/${rarity}`)} colour={rarityColour[rarity]} onGo={() => onGo(`#hoggies/${rarity}`)} />
        ))}
      </ol>
      <p className="gh-contents-note">Tip: open a pack from your bag and its hoggie lands on its page here.</p>
    </div>
  );
}

function TeamsTitle({ world }: { world: World }) {
  const done = world.teams.filter(({ complete }) => complete).length;
  return (
    <div className="gh-page-inner gh-title-page">
      <p className="gh-small-caps">The guild's book of</p>
      <h2 className="gh-title-big">Teams</h2>
      <div className="gh-title-crests">
        {world.teams.slice(0, 6).map((team) => (
          <CrestArt key={team.team} art={team.art} size={46} name={team.name} collected={team.complete || team.crest !== null} />
        ))}
      </div>
      <p className="gh-title-owner">One sticker for every teammate you thank</p>
      <p className="gh-title-total">
        <strong>{done}</strong> of {world.teams.length} pages complete
      </p>
    </div>
  );
}

function TeamsContents({ world, spreads, onGo }: { world: World; spreads: Spread[]; onGo(hash: string): void }) {
  return (
    <div className="gh-page-inner gh-contents">
      <h2 className="gh-page-title">Contents</h2>
      <ol>
        {world.teams.map((team) => (
          <ContentsLine key={team.team} label={team.name} detail={`${team.held}/${team.total}`} page={pageNumberOf(spreads, `#teams/${team.team}`)} colour="#23251d" art={<CrestArt art={team.art} size={20} name={team.name} collected={team.complete || team.crest !== null} />} onGo={() => onGo(`#teams/${team.team}`)} />
        ))}
      </ol>
    </div>
  );
}

function ContentsLine({ label, detail, page, colour, art, onGo }: { label: string; detail: string; page: number; colour: string; art?: ReactNode; onGo(): void }) {
  return (
    <li>
      <button type="button" className="gh-contents-line" onClick={onGo} style={{ "--line": colour } as CSSProperties}>
        {art}
        <span className="gh-contents-label">{label}</span>
        <span className="gh-contents-dots" />
        <span className="gh-contents-detail">{detail}</span>
        <span className="gh-contents-page">p. {page}</span>
      </button>
    </li>
  );
}

function HoggiesPage({ page, spotlight }: { page: Extract<Page, { kind: "hoggies" }>; spotlight: string | null }) {
  const found = page.hoggies.filter(({ count }) => count > 0).length;
  return (
    <div className="gh-page-inner" style={{ "--rarity": rarityColour[page.rarity] } as CSSProperties}>
      <header className="gh-page-band">
        <span className="gh-page-band-title">{page.rarity}</span>
        <span>
          {found}/{page.hoggies.length} · part {page.part} of {page.parts}
        </span>
      </header>
      <ul className="gh-slots">
        {page.hoggies.map((hoggie) => (
          <HoggieSlot key={hoggie.hoggie} hoggie={hoggie} lit={spotlight === hoggie.hoggie} />
        ))}
      </ul>
    </div>
  );
}

function HoggieSlot({ hoggie, lit }: { hoggie: CollectionHoggie; lit: boolean }) {
  const found = hoggie.count > 0;
  return (
    <li className={`gh-slot ${found ? "gh-slot-found" : "gh-slot-missing"} ${lit ? "gh-slot-lit" : ""}`} title={found ? hoggie.name : "Not found yet"}>
      <HoggieArt slug={hoggie.hoggie} size={56} silhouette={!found} />
      <span className="gh-slot-name">{found ? hoggie.name : "???"}</span>
      {hoggie.count > 1 && <span className="gh-slot-count">×{hoggie.count}</span>}
    </li>
  );
}

function TeamCover({ page: { team } }: { page: Extract<Page, { kind: "team-cover" }> }) {
  return (
    <div className="gh-page-inner gh-team-cover">
      <p className="gh-small-caps">{team.mine ? "Your team" : "Team page"}</p>
      <CrestArt art={team.art} size={130} name={team.name} collected={team.complete || team.crest !== null} />
      <h2 className="gh-team-name">{team.name}</h2>
      <p className="gh-team-count">
        <strong>{team.held}</strong> of {team.total} teammates thanked
      </p>
      <Meter value={team.held} max={team.total} label={`${team.name} stickers`} colour="#2f9e44" />
      <p className="gh-team-note">{team.complete ? "Page complete: the crest is yours." : "Thank each teammate once to fill the page and earn the crest."}</p>
      {team.leads.length > 0 && <p className="gh-team-leads">Led by {team.leads.join(" and ")}</p>}
    </div>
  );
}

function TeamPeople({ page }: { page: Extract<Page, { kind: "team-people" }> }) {
  return (
    <div className="gh-page-inner">
      <header className="gh-page-band gh-page-band-team">
        <span className="gh-page-band-title">Teammates</span>
        <span>
          part {page.part} of {page.parts}
        </span>
      </header>
      <ul className="gh-people">
        {page.people.map((person) => (
          <PersonSlot key={person.key} person={person} />
        ))}
      </ul>
    </div>
  );
}

function PersonSlot({ person }: { person: CollectionTeamPerson }) {
  return (
    <li className={`gh-person ${person.held ? "" : "gh-person-missing"} ${person.lead ? "gh-person-lead" : ""}`} title={person.held ? `${person.name}, thanked` : `Thank ${person.name} to get their sticker`}>
      {person.lead && <span className="gh-lead-star">★</span>}
      {person.held ? <MemberFace face={person.face} className="gh-person-face" /> : <span className="gh-person-face gh-person-unknown">?</span>}
      <span className="gh-person-name">{person.name.split(" ")[0]}</span>
      {person.role !== null && <span className="gh-person-role">{person.role}</span>}
    </li>
  );
}

