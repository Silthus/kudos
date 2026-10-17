// PROTOTYPE (#625): the left-docked book: Hoggies or Teams, a contents spread up front, ribbons to jump, fixed size, page turns on ←/→. Never merge to main.
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { CollectionHoggie, CollectionTeamPerson } from "../../../collectionRead";
import { HedgehogCodingGroup, HedgehogReadingIsMagic } from "../../../hoggies";
import { prefersReducedMotion } from "../../../reducedMotion";
import { CrestArt, HoggieArt, MemberFace } from "../../art";
import { rarityColour, type World } from "../../world";
import { rarityName, Meter } from "./bits";
import { firstPageOf, spreadIndexAt, spreadsOf, type BookId, type Spread } from "./books";
import { isTyping } from "./navigation";
import { Frame } from "./windows";

type Turn = { way: "forward" | "back"; serial: number };

type BookProps = { book: BookId; hash: string; world: World; spotlight: string | null; keysOn: boolean; onHash(hash: string): void; onSwitch(book: BookId): void; onClose(): void };

const bookTitle: Record<BookId, string> = { hoggies: "Hoggie book", teams: "Team book" };

export function Book({ book, hash, world, spotlight, keysOn, onHash, onSwitch, onClose }: BookProps) {
  const spreads = useMemo(() => spreadsOf(book, world), [book, world]);
  const [turn, setTurn] = useState<Turn | null>(null);
  const index = spreadIndexAt(spreads, hash);
  const spread = spreads[index]!;

  const goTo = useCallback(
    (next: number) => {
      const target = spreads[Math.min(spreads.length - 1, Math.max(0, next))];
      if (target === undefined || target === spreads[index]) return;
      if (!prefersReducedMotion()) setTurn((current) => ({ way: next > index ? "forward" : "back", serial: (current?.serial ?? 0) + 1 }));
      onHash(target.hash);
    },
    [spreads, index, onHash],
  );
  const goToHash = (hash: string) => goTo(spreadIndexAt(spreads, hash));

  useEffect(() => {
    if (!keysOn) return;
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowRight") goTo(index + 1);
      else if (event.key === "ArrowLeft") goTo(index - 1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index, keysOn]);

  const page = firstPageOf(spreads, index);
  return (
    <Frame
      title={bookTitle[book]}
      icon={book === "hoggies" ? <HoggieArt slug="wizard" size={26} /> : <CrestArt art={{ kind: "crest", slug: "workflows" }} size={24} />}
      className={`mr-frame-left mr-book-frame mr-book-${book}`}
      onClose={onClose}
      footer={
        <div className="mr-pager">
          <button type="button" className="mr-pager-button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous pages">
            ◀
          </button>
          <span>
            Pages {page}–{page + 1} of {spreads.length * 2} · ←/→ to turn
          </span>
          <button type="button" className="mr-pager-button" onClick={() => goTo(index + 1)} disabled={index === spreads.length - 1} aria-label="Next pages">
            ▶
          </button>
        </div>
      }
    >
      <div className="mr-book-switch" role="tablist" aria-label="Books">
        {(["hoggies", "teams"] as const).map((each) => (
          <button key={each} type="button" role="tab" aria-selected={each === book} className="mr-book-switch-tab" onClick={() => each !== book && onSwitch(each)}>
            {bookTitle[each]}
          </button>
        ))}
      </div>
      <div className="mr-book">
        <div className="mr-book-pages">
          <SpreadPages spread={spread} spreads={spreads} world={world} spotlight={spotlight} page={page} onGo={goToHash} />
          {turn !== null && <span key={turn.serial} className={`mr-leaf mr-leaf-${turn.way}`} aria-hidden="true" onAnimationEnd={() => setTurn(null)} />}
        </div>
        <Ribbons book={book} spread={spread} world={world} onGo={goToHash} />
      </div>
    </Frame>
  );
}

function Ribbons({ book, spread, world, onGo }: { book: BookId; spread: Spread; world: World; onGo(hash: string): void }) {
  const ribbons =
    book === "hoggies"
      ? [{ hash: "#hoggies", label: "Contents", colour: "#5a3412", art: null as ReactNode, current: spread.kind === "hoggie-contents" }, ...world.rarities.map(({ rarity }) => ({ hash: `#hoggies/${rarity}`, label: rarityName[rarity], colour: rarityColour[rarity], art: null as ReactNode, current: spread.kind === "hoggies" && spread.rarity === rarity }))]
      : [{ hash: "#teams", label: "Contents", colour: "#5a3412", art: null as ReactNode, current: spread.kind === "team-contents" }, ...world.teams.map((team) => ({ hash: `#teams/${team.team}`, label: team.name, colour: team.mine ? "#f54e00" : "#2a4f86", art: <CrestArt art={team.art} size={20} name={team.name} collected={team.complete || team.crest !== null} />, current: spread.kind === "team" && spread.team.team === team.team }))];
  return (
    <nav className={`mr-ribbons mr-ribbons-${book}`} aria-label="Jump to">
      {ribbons.map((ribbon) => (
        <button key={ribbon.hash} type="button" className="mr-ribbon" aria-current={ribbon.current} style={{ "--ribbon": ribbon.colour } as CSSProperties} onClick={() => onGo(ribbon.hash)} title={ribbon.label}>
          {ribbon.art ?? <span className="mr-ribbon-label">{ribbon.label}</span>}
        </button>
      ))}
    </nav>
  );
}

type SpreadProps = { spread: Spread; spreads: Spread[]; world: World; spotlight: string | null; page: number; onGo(hash: string): void };

function SpreadPages({ spread, spreads, world, spotlight, page, onGo }: SpreadProps) {
  if (spread.kind === "hoggie-contents") return <HoggieContents world={world} spreads={spreads} onGo={onGo} />;
  if (spread.kind === "team-contents") return <TeamContents world={world} spreads={spreads} onGo={onGo} />;
  if (spread.kind === "hoggies")
    return (
      <>
        <Page side="left" number={page}>
          <PageHead title={`${rarityName[spread.rarity]} hoggies`} colour={rarityColour[spread.rarity]} detail={spread.parts > 1 ? `part ${spread.part} of ${spread.parts}` : `${world.rarities.find(({ rarity }) => rarity === spread.rarity)?.owned ?? 0} of ${world.rarities.find(({ rarity }) => rarity === spread.rarity)?.total ?? 0} found`} />
          <HoggieGrid hoggies={spread.left} spotlight={spotlight} />
        </Page>
        <Page side="right" number={page + 1}>
          <PageHead title="" colour={rarityColour[spread.rarity]} detail="" />
          <HoggieGrid hoggies={spread.right} spotlight={spotlight} />
        </Page>
      </>
    );
  const { team } = spread;
  return (
    <>
      <Page side="left" number={page}>
        <PageHead title="Team page" colour="#5a3412" detail={team.mine ? "Your team" : ""} />
        <div className="mr-team-crest">
          <CrestArt art={team.art} size={150} name={team.name} collected={team.complete || team.crest !== null} />
          {team.complete && <span className="mr-stamp">Complete</span>}
        </div>
        <h3 className="mr-team-name">{team.name}</h3>
        <p className="mr-team-count">
          <strong>{team.held}</strong> of {team.total} teammates thanked
        </p>
        <Meter value={team.held} max={team.total} label={`${team.name} stickers`} tone="gold" />
        {team.leads.length > 0 && <p className="mr-team-leads">Led by {team.leads.join(" and ")}</p>}
        <p className="mr-team-note">{team.complete ? "Every sticker is in: the crest is yours." : "Thank each teammate once to fill the page and earn the crest."}</p>
      </Page>
      <Page side="right" number={page + 1}>
        <PageHead title={spread.parts > 1 ? `Teammates, part ${spread.part}` : "Teammates"} colour="#5a3412" detail={`${spread.people.filter(({ held }) => held).length} of ${spread.people.length} here`} />
        <ul className="mr-people">
          {spread.people.map((person) => (
            <PersonSlot key={person.key} person={person} lit={spotlight === person.key} />
          ))}
        </ul>
      </Page>
    </>
  );
}

function Page({ side, number, children }: { side: "left" | "right"; number: number; children: ReactNode }) {
  return (
    <article className={`mr-page mr-page-${side}`}>
      {children}
      <p className="mr-folio">{number}</p>
    </article>
  );
}

function PageHead({ title, colour, detail }: { title: string; colour: string; detail: string }) {
  return (
    <header className="mr-page-head">
      <h2 style={{ color: colour }}>{title}</h2>
      <span>{detail}</span>
    </header>
  );
}

function HoggieGrid({ hoggies, spotlight }: { hoggies: CollectionHoggie[]; spotlight: string | null }) {
  return (
    <ul className="mr-page-hoggies">
      {hoggies.map((hoggie) => {
        const missing = hoggie.count === 0;
        return (
          <li key={hoggie.hoggie} className={`mr-page-hoggie ${missing ? "mr-missing" : ""} ${spotlight === hoggie.hoggie ? "mr-lit" : ""}`} style={{ "--glow": rarityColour[hoggie.rarity] } as CSSProperties} title={missing ? "Not found yet" : `${hoggie.name} ×${hoggie.count}`}>
            <HoggieArt slug={hoggie.hoggie} size={58} silhouette={missing} />
            <span>{missing ? "???" : hoggie.name}</span>
            {hoggie.count > 1 && <small>×{hoggie.count}</small>}
          </li>
        );
      })}
    </ul>
  );
}

function PersonSlot({ person, lit }: { person: CollectionTeamPerson; lit: boolean }) {
  return (
    <li className={`mr-person ${person.held ? "" : "mr-missing"} ${person.lead ? "mr-person-lead" : ""} ${lit ? "mr-lit" : ""}`} title={person.role === null ? person.name : `${person.name}, ${person.role}`}>
      {person.held ? <MemberFace face={person.face} className="mr-person-face" /> : <span className="mr-person-face mr-person-unknown">?</span>}
      <span className="mr-person-name">
        {person.lead && "★ "}
        {person.name.split(" ")[0]}
      </span>
    </li>
  );
}

function ContentsLine({ label, detail, page, colour, art, onGo }: { label: string; detail: string; page: number; colour: string; art?: ReactNode; onGo(): void }) {
  return (
    <li>
      <button type="button" className="mr-contents-line" onClick={onGo} style={{ "--line": colour } as CSSProperties}>
        {art}
        <span className="mr-contents-label">{label}</span>
        <span className="mr-contents-dots" />
        <span className="mr-contents-detail">{detail}</span>
        <span className="mr-contents-page">p. {page}</span>
      </button>
    </li>
  );
}

function HoggieContents({ world, spreads, onGo }: { world: World; spreads: Spread[]; onGo(hash: string): void }) {
  const pageOf = (hash: string) => firstPageOf(spreads, spreadIndexAt(spreads, hash));
  return (
    <>
      <Page side="left" number={1}>
        <div className="mr-title-page">
          <p className="mr-small-print">HedgeHug · season 2026</p>
          <h2>The Hoggie Book</h2>
          <p className="mr-belongs">
            belongs to <strong>{world.me.name}</strong>
          </p>
          <HedgehogReadingIsMagic size={130} />
          <p className="mr-title-total">
            <strong>{world.owned}</strong> of {world.total} hoggies found
          </p>
          <ul className="mr-tally">
            {world.rarities.map(({ rarity, owned, total }) => (
              <li key={rarity} style={{ "--line": rarityColour[rarity] } as CSSProperties}>
                <span>{rarityName[rarity]}</span>
                <span className="mr-tally-bar">
                  <span style={{ width: `${(owned / Math.max(1, total)) * 100}%` }} />
                </span>
                <span>
                  {owned}/{total}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Page>
      <Page side="right" number={2}>
        <h2 className="mr-contents-title">Contents</h2>
        <ol className="mr-contents">
          {world.rarities.map(({ rarity, owned, total }) => (
            <ContentsLine key={rarity} label={rarityName[rarity]} detail={`${owned}/${total}`} page={pageOf(`#hoggies/${rarity}`)} colour={rarityColour[rarity]} art={<HoggieArt slug={world.hoggies.find((hoggie) => hoggie.rarity === rarity && hoggie.count > 0)?.hoggie ?? "wizard"} size={30} />} onGo={() => onGo(`#hoggies/${rarity}`)} />
          ))}
        </ol>
        <p className="mr-contents-tip">Ribbons on the edge jump to a chapter. ←/→ turn the pages.</p>
      </Page>
    </>
  );
}

function TeamContents({ world, spreads, onGo }: { world: World; spreads: Spread[]; onGo(hash: string): void }) {
  const pageOf = (hash: string) => firstPageOf(spreads, spreadIndexAt(spreads, hash));
  const complete = world.teams.filter(({ complete }) => complete).length;
  const held = world.teams.reduce((sum, team) => sum + team.held, 0);
  return (
    <>
      <Page side="left" number={1}>
        <div className="mr-title-page">
          <p className="mr-small-print">HedgeHug · season 2026</p>
          <h2>The Team Book</h2>
          <p className="mr-belongs">one sticker for every teammate you thank</p>
          <HedgehogCodingGroup size={150} />
          <p className="mr-title-total">
            <strong>{held}</strong> stickers · <strong>{complete}</strong> of {world.teams.length} pages complete
          </p>
        </div>
      </Page>
      <Page side="right" number={2}>
        <h2 className="mr-contents-title">Contents</h2>
        <ol className="mr-contents">
          {world.teams.map((team) => (
            <ContentsLine key={team.team} label={team.mine ? `${team.name} (yours)` : team.name} detail={`${team.held}/${team.total}`} page={pageOf(`#teams/${team.team}`)} colour={team.complete ? "#b07a00" : "#23251d"} art={<CrestArt art={team.art} size={28} name={team.name} collected={team.complete || team.crest !== null} />} onGo={() => onGo(`#teams/${team.team}`)} />
          ))}
        </ol>
      </Page>
    </>
  );
}
