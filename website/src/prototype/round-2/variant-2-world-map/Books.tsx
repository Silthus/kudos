// PROTOTYPE (#625): the Hoggie book and the Team book: fixed-size spreads with a contents page, side tabs, ribbons and page turns. Never merge to main.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { CollectionTeamPage, CollectionTeamPerson } from "../../../collectionRead";
import { HedgehogCodingGroup, HedgehogReading, HedgehogReadingIsMagic, HedgehogStar } from "../../../hoggies";
import { CrestArt, HoggieArt, MemberFace } from "../../art";
import { rarityColour, rarityOrder, type World } from "../../world";
import { rarityLabel, shortDate } from "./bits";
import { firstPageOf, hoggieSpreadsOf, spreadIndexAt, teamSpreadsOf, type Leaf, type NumberedHoggie, type Spread } from "./bookSpreads";
import { prefersReducedMotion } from "./motion";

type Tab = { tab: string; label: string; colour: string; art?: ReactNode };

type Ribbon = { label: string; colour: string; hash: string };

type Turn = { way: "forward" | "back"; serial: number };

type ShellProps = { spreads: Spread[]; hash: string; front: boolean; tabs: Tab[]; ribbons: Ribbon[]; cover: string; onTurnTo: (hash: string) => void; leafOf: (leaf: Leaf, side: "left" | "right") => ReactNode };

function BookShell({ spreads, hash, front, tabs, ribbons, cover, onTurnTo, leafOf }: ShellProps) {
  const index = spreadIndexAt(spreads, hash);
  const spread = spreads[index]!;
  const [turn, setTurn] = useState<Turn | null>(null);

  const goTo = (next: number) => {
    const target = spreads[Math.min(spreads.length - 1, Math.max(0, next))];
    if (target === undefined || target === spread) return;
    if (!prefersReducedMotion()) setTurn((current) => ({ way: next > index ? "forward" : "back", serial: (current?.serial ?? 0) + 1 }));
    onTurnTo(target.hash);
  };

  useEffect(() => {
    if (!front) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select")) return;
      if (event.key === "ArrowRight") goTo(index + 1);
      else if (event.key === "ArrowLeft") goTo(index - 1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={`wm-book wm-book-${cover}`}>
      <div className="wm-book-ribbons">
        {ribbons.map((ribbon) => (
          <button key={ribbon.label} type="button" className="wm-ribbon" style={{ "--wm-ribbon": ribbon.colour } as CSSProperties} onClick={() => goTo(spreads.findIndex(({ hash: each }) => each === ribbon.hash))} aria-current={ribbon.hash === spread.hash}>
            <span>{ribbon.label}</span>
          </button>
        ))}
      </div>
      <div className="wm-book-pages">
        <article className="wm-page wm-page-left">
          {leafOf(spread.left, "left")}
          <span className="wm-page-number">{index * 2 + 1}</span>
        </article>
        <article className="wm-page wm-page-right">
          {leafOf(spread.right, "right")}
          <span className="wm-page-number">{index * 2 + 2}</span>
        </article>
        <span className="wm-book-gutter" aria-hidden="true" />
        {turn !== null && <span key={turn.serial} className={`wm-leaf wm-leaf-${turn.way}`} aria-hidden="true" onAnimationEnd={() => setTurn(null)} />}
      </div>
      <nav className="wm-book-tabs" aria-label="Chapters">
        {tabs.map((tab) => (
          <button key={tab.tab} type="button" className="wm-book-tab" style={{ "--wm-tab": tab.colour } as CSSProperties} aria-current={spread.tab === tab.tab} onClick={() => goTo(spreads.findIndex((each) => each.tab === tab.tab))} title={tab.label}>
            {tab.art ?? <span>{tab.label}</span>}
          </button>
        ))}
      </nav>
      <footer className="wm-book-foot">
        <button type="button" className="wm-flip" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous pages">
          ◀
        </button>
        <span>
          Pages {index * 2 + 1}–{index * 2 + 2} of {spreads.length * 2} · ←/→ to turn
        </span>
        <button type="button" className="wm-flip" onClick={() => goTo(index + 1)} disabled={index === spreads.length - 1} aria-label="Next pages">
          ▶
        </button>
      </footer>
    </div>
  );
}

const numberOf = (number: number) => `#${String(number).padStart(3, "0")}`;

type BookProps = { world: World; hash: string; front: boolean; fresh: ReadonlySet<string>; onTurnTo: (hash: string) => void };

export function HoggieBook({ world, hash, front, fresh, onTurnTo }: BookProps) {
  const spreads = hoggieSpreadsOf(world);
  const tabs: Tab[] = [{ tab: "contents", label: "Contents", colour: "#8b6a3a" }, ...rarityOrder.map((rarity) => ({ tab: rarity, label: rarityLabel[rarity], colour: rarityColour[rarity] }))];
  const newest = world.hoggies.filter(({ firstAt }) => firstAt !== null).toSorted((first, second) => (second.firstAt ?? 0) - (first.firstAt ?? 0))[0];
  const ribbons: Ribbon[] = [{ label: "Contents", colour: "#8b6a3a", hash: "#hoggies" }, ...(newest === undefined ? [] : [{ label: `Newest: ${newest.name}`, colour: "#f54e00", hash: spreads.find(({ left, right }) => [left, right].some((leaf) => leaf.kind === "hoggies" && leaf.hoggies.some(({ hoggie }) => hoggie === newest.hoggie)))?.hash ?? "#hoggies" }])];
  const leafOf = (leaf: Leaf) => {
    if (leaf.kind === "title") return <HoggieTitle world={world} />;
    if (leaf.kind === "contents") return <Contents title="Contents" lines={rarityOrder.map((rarity) => ({ key: rarity, label: rarityLabel[rarity], colour: rarityColour[rarity], detail: `${world.rarities.find((entry) => entry.rarity === rarity)?.owned ?? 0}/${world.rarities.find((entry) => entry.rarity === rarity)?.total ?? 0}`, page: firstPageOf(spreads, rarity), hash: `#hoggies/${rarity}` }))} onGo={onTurnTo} />;
    if (leaf.kind === "hoggies") return <HoggieLeaf leaf={leaf} fresh={fresh} />;
    return <BlankLeaf />;
  };
  return <BookShell spreads={spreads} hash={hash} front={front} tabs={tabs} ribbons={ribbons} cover="hoggies" onTurnTo={onTurnTo} leafOf={leafOf} />;
}

function HoggieTitle({ world }: { world: World }) {
  return (
    <div className="wm-leaf-inner wm-title-leaf">
      <p className="wm-print-small">The Hoggie Book of</p>
      <h3 className="wm-title-name">{world.me.name}</h3>
      <HedgehogReading size={130} />
      <p className="wm-title-total">
        <strong>{world.owned}</strong> of {world.total} hoggies found
      </p>
      <ul className="wm-tally">
        {world.rarities.map(({ rarity, owned, total }) => (
          <li key={rarity} style={{ "--wm-rarity": rarityColour[rarity] } as CSSProperties}>
            <span>{rarityLabel[rarity]}</span>
            <span className="wm-tally-bar">
              <span style={{ width: `${(owned / Math.max(1, total)) * 100}%` }} />
            </span>
            <span>
              {owned}/{total}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type ContentsLine = { key: string; label: string; detail: string; colour: string; page: number; hash: string; art?: ReactNode };

function Contents({ title, lines, onGo }: { title: string; lines: ContentsLine[]; onGo: (hash: string) => void }) {
  return (
    <div className="wm-leaf-inner wm-contents">
      <h3 className="wm-leaf-title">{title}</h3>
      <ol className="wm-contents-list">
        {lines.map((line) => (
          <li key={line.key}>
            <button type="button" className="wm-contents-line" style={{ "--wm-line": line.colour } as CSSProperties} onClick={() => onGo(line.hash)}>
              {line.art}
              <span className="wm-contents-label">{line.label}</span>
              <span className="wm-contents-dots" />
              <span className="wm-contents-detail">{line.detail}</span>
              <span className="wm-contents-page">p. {line.page}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function HoggieLeaf({ leaf, fresh }: { leaf: Extract<Leaf, { kind: "hoggies" }>; fresh: ReadonlySet<string> }) {
  return (
    <div className="wm-leaf-inner" style={{ "--wm-rarity": rarityColour[leaf.rarity] } as CSSProperties}>
      <header className="wm-leaf-band">
        <span>{rarityLabel[leaf.rarity]}</span>
        <small>
          page {leaf.part} of {leaf.parts}
        </small>
      </header>
      <ul className="wm-slots">
        {leaf.hoggies.map((hoggie) => (
          <HoggieSlot key={hoggie.hoggie} hoggie={hoggie} fresh={fresh.has(hoggie.hoggie)} />
        ))}
      </ul>
    </div>
  );
}

function HoggieSlot({ hoggie, fresh }: { hoggie: NumberedHoggie; fresh: boolean }) {
  const missing = hoggie.count === 0;
  return (
    <li className={`wm-slot ${missing ? "wm-slot-missing" : ""} ${fresh ? "wm-slot-fresh" : ""}`} title={missing ? `${numberOf(hoggie.number)}: not found yet` : `${hoggie.name}${hoggie.firstAt === null ? "" : `, first found ${shortDate(hoggie.firstAt)}`}`}>
      <span className="wm-slot-number">{numberOf(hoggie.number)}</span>
      <HoggieArt slug={hoggie.hoggie} size={58} silhouette={missing} />
      <span className="wm-slot-name">{missing ? "?" : hoggie.name}</span>
      {hoggie.count > 1 && <span className="wm-slot-count">×{hoggie.count}</span>}
      {fresh && <span className="wm-slot-new">NEW</span>}
    </li>
  );
}

function BlankLeaf() {
  return (
    <div className="wm-leaf-inner wm-blank-leaf">
      <HedgehogReadingIsMagic size={130} />
      <p className="wm-print-small">Room for more</p>
    </div>
  );
}

export function TeamBook({ world, hash, front, onTurnTo }: Omit<BookProps, "fresh">) {
  const spreads = teamSpreadsOf(world);
  const tabs: Tab[] = [{ tab: "contents", label: "Contents", colour: "#8b6a3a" }, ...world.teams.map((team) => ({ tab: team.team, label: team.name, colour: team.mine ? "#1d4aff" : "#6b7a3a", art: <CrestArt art={team.art} size={24} name={team.name} collected={team.complete || team.held > 0} /> }))];
  const mine = world.teams.find(({ mine: isMine }) => isMine);
  const ribbons: Ribbon[] = [{ label: "Contents", colour: "#8b6a3a", hash: "#teams" }, ...(mine === undefined ? [] : [{ label: `Your team: ${mine.name}`, colour: "#1d4aff", hash: `#teams/${mine.team}` }])];
  const leafOf = (leaf: Leaf) => {
    if (leaf.kind === "title") return <TeamTitle world={world} />;
    if (leaf.kind === "contents") return <Contents title="Team pages" lines={world.teams.map((team) => ({ key: team.team, label: team.name, colour: "#23251d", detail: `${team.held}/${team.total}`, page: firstPageOf(spreads, team.team), hash: `#teams/${team.team}`, art: <CrestArt art={team.art} size={22} name={team.name} collected={team.complete || team.held > 0} /> }))} onGo={onTurnTo} />;
    if (leaf.kind === "team-cover") return <TeamCover team={leaf.team} />;
    if (leaf.kind === "stickers") return <StickerLeaf team={leaf.team} part={leaf.part} people={leaf.people} />;
    return <BlankLeaf />;
  };
  return <BookShell spreads={spreads} hash={hash} front={front} tabs={tabs} ribbons={ribbons} cover="teams" onTurnTo={onTurnTo} leafOf={leafOf} />;
}

function TeamTitle({ world }: { world: World }) {
  const held = world.teams.reduce((sum, team) => sum + team.held, 0);
  const total = world.teams.reduce((sum, team) => sum + team.total, 0);
  return (
    <div className="wm-leaf-inner wm-title-leaf">
      <p className="wm-print-small">The Team Book of</p>
      <h3 className="wm-title-name">{world.me.name}</h3>
      <HedgehogCodingGroup size={140} />
      <p className="wm-title-total">
        <strong>{held}</strong> of {total} teammates' stickers
      </p>
      <p className="wm-print-small">Thank a teammate to stick them in. Fill a page to win its crest.</p>
    </div>
  );
}

function TeamCover({ team }: { team: CollectionTeamPage }) {
  return (
    <div className="wm-leaf-inner wm-team-cover">
      <p className="wm-print-small">{team.mine ? "Your team" : "Team page"}</p>
      <span className="wm-team-crest">
        <CrestArt art={team.art} size={140} name={team.name} collected={team.complete || team.crest !== null} />
        {team.complete && <span className="wm-team-stamp">Complete</span>}
      </span>
      <h3 className="wm-title-name">{team.name}</h3>
      <p className="wm-team-count">
        {team.held} of {team.total} teammates thanked
      </p>
      <span className="wm-tally-bar wm-team-bar">
        <span style={{ width: `${(team.held / Math.max(1, team.total)) * 100}%` }} />
      </span>
      {team.leads.length > 0 && <p className="wm-print-small">Led by {team.leads.join(" and ")}</p>}
      {!team.complete && <p className="wm-team-hint">{team.total - team.held} more to win the crest</p>}
      {team.complete && <HedgehogStar size={60} />}
    </div>
  );
}

function StickerLeaf({ team, part, people }: { team: CollectionTeamPage; part: number; people: CollectionTeamPerson[] }) {
  return (
    <div className="wm-leaf-inner">
      <header className="wm-leaf-band wm-leaf-band-team">
        <span>{team.name}</span>
        <small>stickers, part {part}</small>
      </header>
      <ul className="wm-stickers">
        {people.map((person) => (
          <PersonSticker key={person.key} person={person} />
        ))}
      </ul>
    </div>
  );
}

function PersonSticker({ person }: { person: CollectionTeamPerson }) {
  return (
    <li className={`wm-person ${person.lead ? "wm-person-lead" : ""} ${person.held ? "" : "wm-person-missing"}`} title={person.held ? `${person.name}${person.role === null ? "" : `, ${person.role}`}${person.heldAt === null ? "" : `, since ${shortDate(person.heldAt)}`}` : `Thank ${person.name} to get this sticker`}>
      {person.held ? <MemberFace face={person.face} className="wm-person-face" /> : <span className="wm-person-face wm-person-unknown">?</span>}
      <span className="wm-person-name">{person.lead ? person.name : person.name.split(" ")[0]}</span>
      {person.lead && <span className="wm-person-role">★ Lead{person.role === null ? "" : ` · ${person.role}`}</span>}
    </li>
  );
}
