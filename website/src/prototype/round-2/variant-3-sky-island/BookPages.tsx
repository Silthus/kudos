// PROTOTYPE (#625): what is printed on one page of the Hoggies or Teams book: the index, a rarity page, a team page. Never merge to main.
import type { CSSProperties, ReactNode } from "react";
import type { CollectionHoggie, CollectionTeamPerson } from "../../../collectionRead";
import { HedgehogReading, HedgehogCodingGroup } from "../../../hoggies";
import { CrestArt, HoggieArt, MemberFace } from "../../art";
import { rarityColour, type World } from "../../world";
import type { BookPage, HoggiePage, IndexPage, TeamPage } from "./books";
import { Meter, rarityLabel } from "./looks";

type PageProps = { page: BookPage; pages: BookPage[]; world: World; spotlight: string | null; onFlip: (hash: string) => void };

export function BookPageView({ page, pages, world, spotlight, onFlip }: PageProps) {
  if (page.kind === "index") return <IndexView page={page} pages={pages} world={world} onFlip={onFlip} />;
  if (page.kind === "hoggies") return <HoggiesView page={page} spotlight={spotlight} />;
  return <TeamView page={page} spotlight={spotlight} />;
}

function pageNumberOf(pages: BookPage[], hash: string) {
  return pages.findIndex((page) => page.hash === hash) + 1;
}

function IndexView({ page, pages, world, onFlip }: { page: IndexPage; pages: BookPage[]; world: World; onFlip: (hash: string) => void }) {
  const hoggies = page.book === "hoggies";
  const complete = world.teams.filter((team) => team.complete).length;
  return (
    <div className="sk-page-inner sk-index">
      <p className="sk-print-small">{hoggies ? "The Hoggie book" : "The Team book"}</p>
      <h2 className="sk-index-title">Contents</h2>
      <p className="sk-index-owner">
        This book belongs to <strong>{world.me.name}</strong>
      </p>
      <div className="sk-index-summary">
        {hoggies ? <HedgehogReading size={72} /> : <HedgehogCodingGroup size={72} />}
        <div>
          <p className="sk-index-total">{hoggies ? `${world.owned} of ${world.total} hoggies found` : `${complete} of ${world.teams.length} team pages complete`}</p>
          <Meter value={hoggies ? world.owned : complete} max={hoggies ? world.total : world.teams.length} label="Book progress" />
        </div>
      </div>
      <ol className="sk-contents">
        {hoggies
          ? world.rarities.map(({ rarity, owned, total }) => {
              const hash = `#hoggies/${rarity}/1`;
              return <ContentsLine key={rarity} label={rarityLabel[rarity]} detail={`${owned}/${total}`} page={pageNumberOf(pages, hash)} colour={rarityColour[rarity]} onGo={() => onFlip(hash)} />;
            })
          : world.teams.map((team) => {
              const hash = `#teams/${team.team}`;
              return <ContentsLine key={team.team} label={team.name} detail={`${team.held}/${team.total}`} page={pageNumberOf(pages, hash)} colour="#23251d" mark={team.mine ? "Your team" : team.complete ? "Complete" : undefined} crest={<CrestArt art={team.art} size={26} name={team.name} collected={team.complete || team.crest !== null} />} onGo={() => onFlip(hash)} />;
            })}
      </ol>
    </div>
  );
}

function ContentsLine({ label, detail, page, colour, mark, crest, onGo }: { label: string; detail: string; page: number; colour: string; mark?: string; crest?: ReactNode; onGo: () => void }) {
  return (
    <li>
      <button type="button" className="sk-contents-line" onClick={onGo} style={{ "--line": colour } as CSSProperties}>
        {crest}
        <span className="sk-contents-label">{label}</span>
        {mark !== undefined && <span className="sk-contents-mark">{mark}</span>}
        <span className="sk-contents-dots" aria-hidden="true" />
        <span className="sk-contents-detail">{detail}</span>
        <span className="sk-contents-page">p. {page}</span>
      </button>
    </li>
  );
}

function HoggiesView({ page, spotlight }: { page: HoggiePage; spotlight: string | null }) {
  const found = page.hoggies.filter(({ count }) => count > 0).length;
  return (
    <div className="sk-page-inner" style={{ "--rarity": rarityColour[page.chapter] } as CSSProperties}>
      <header className="sk-page-band">
        <span className="sk-page-band-title">{rarityLabel[page.chapter]}</span>
        <span className="sk-print-small">
          {found}/{page.hoggies.length} here{page.parts > 1 ? ` · part ${page.part} of ${page.parts}` : ""}
        </span>
      </header>
      <ul className="sk-slots">
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
    <li className={`sk-slot ${found ? "sk-slot-found" : "sk-slot-missing"} ${lit ? "sk-slot-lit" : ""}`} title={found ? hoggie.name : "Not found yet"}>
      <HoggieArt slug={hoggie.hoggie} size={56} silhouette={!found} />
      <span className="sk-slot-name">{found ? hoggie.name : "???"}</span>
      {hoggie.count > 1 && <span className="sk-slot-count">×{hoggie.count}</span>}
    </li>
  );
}

function TeamView({ page, spotlight }: { page: TeamPage; spotlight: string | null }) {
  const { team } = page;
  return (
    <div className="sk-page-inner sk-team-page">
      <header className="sk-team-head">
        <CrestArt art={team.art} size={page.part === 1 ? 76 : 44} name={team.name} collected={team.complete || team.crest !== null} />
        <div className="sk-team-head-text">
          <p className="sk-print-small">{team.mine ? "Your team" : "Team page"}{page.parts > 1 ? ` · part ${page.part} of ${page.parts}` : ""}</p>
          <h2 className="sk-team-name">{team.name}</h2>
          <p className="sk-team-count">
            {team.held} of {team.total} teammates thanked {team.complete && <span className="sk-team-done">Crest earned!</span>}
          </p>
          <Meter value={team.held} max={team.total} label={`${team.name} stickers`} colour="#1f8a3b" />
        </div>
      </header>
      <ul className="sk-people">
        {page.people.map((person) => (
          <PersonSlot key={person.key} person={person} lit={spotlight === person.key} />
        ))}
      </ul>
      {team.leads.length > 0 && page.part === 1 && <p className="sk-team-leads">★ Led by {team.leads.join(" and ")}</p>}
    </div>
  );
}

function PersonSlot({ person, lit }: { person: CollectionTeamPerson; lit: boolean }) {
  return (
    <li className={`sk-person ${person.held ? "sk-person-held" : "sk-person-missing"} ${person.lead ? "sk-person-lead" : ""} ${lit ? "sk-slot-lit" : ""}`} title={person.held ? `${person.name}, thanked` : `Thank ${person.name} to collect their sticker`}>
      {person.lead && <span className="sk-person-star" aria-label="Lead">★</span>}
      {person.held ? <MemberFace face={person.face} className="sk-person-face" /> : <PersonSilhouette />}
      <span className="sk-person-name">{person.name}</span>
      <span className="sk-person-role">{person.held ? (person.role ?? "Teammate") : "Not thanked yet"}</span>
    </li>
  );
}

function PersonSilhouette() {
  return (
    <svg viewBox="0 0 40 40" className="sk-person-silhouette" aria-hidden="true">
      <circle cx="20" cy="14" r="8" />
      <path d="M5 38c1-9 7-14 15-14s14 5 15 14z" />
    </svg>
  );
}
