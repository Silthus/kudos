// PROTOTYPE (#625): one printed page of the sticker album: welcome, contents, hoggie slots, team pages, notes.
import type { CSSProperties } from "react";
import { HedgehogReading, HedgehogStar } from "../../hoggies";
import type { CollectionTeamPage } from "../../collectionRead";
import type { Rarity } from "../../shell";
import { CrestArt, HoggieArt, MemberFace } from "../art";
import { rarityColour, type World } from "../world";
import type { AlbumPage, NumberedHoggie, NumberedPerson, Spread } from "./albumPages";

type PageProps = { page: AlbumPage; world: World; spreads: Spread[]; justStuck: string | null; onGoTo: (id: string) => void };

export function AlbumPageView({ page, world, spreads, justStuck, onGoTo }: PageProps) {
  if (page.kind === "welcome") return <WelcomePage world={world} />;
  if (page.kind === "contents") return <ContentsPage world={world} spreads={spreads} onGoTo={onGoTo} />;
  if (page.kind === "hoggies") return <HoggiePage rarity={page.rarity} part={page.part} parts={page.parts} slots={page.slots} justStuck={justStuck} />;
  if (page.kind === "team-header") return <TeamHeaderPage page={page} />;
  if (page.kind === "team") return <TeamPage page={page} />;
  if (page.kind === "team-sheet") return <TeamSheetPage team={page.team} />;
  return <NotesPage />;
}

const numberOf = (number: number) => `#${String(number).padStart(3, "0")}`;

const tiltOf = (number: number) => `${((number * 37) % 7) - 3}deg`;

function WelcomePage({ world }: { world: World }) {
  return (
    <div className="v5-page-inner v5-welcome">
      <p className="v5-print-small">HedgeHug sticker album · season 2026</p>
      <div className="v5-name-label">
        <span className="v5-print-small">This album belongs to</span>
        <span className="v5-name-label-name">{world.me.name}</span>
      </div>
      <div className="v5-welcome-hog">
        <HedgehogStar size={120} />
      </div>
      <p className="v5-welcome-total">
        <strong>{world.owned}</strong> of {world.total} hoggies stuck in
      </p>
      <ul className="v5-rarity-tally">
        {world.rarities.map(({ rarity, owned, total }) => (
          <li key={rarity} style={{ "--rarity": rarityColour[rarity] } as CSSProperties}>
            <span className="v5-rarity-name">{rarity}</span>
            <span className="v5-rarity-bar">
              <span style={{ width: `${(owned / Math.max(total, 1)) * 100}%` }} />
            </span>
            <span className="v5-rarity-count">
              {owned}/{total}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContentsPage({ world, spreads, onGoTo }: { world: World; spreads: Spread[]; onGoTo: (id: string) => void }) {
  const firstOf = (section: string) => spreads.find((spread) => spread.section === section);
  return (
    <div className="v5-page-inner v5-contents">
      <h2 className="v5-page-title">Contents</h2>
      <p className="v5-contents-group">Hoggies</p>
      <ol className="v5-contents-list">
        {world.rarities.map(({ rarity, owned, total }) => (
          <ContentsLine key={rarity} label={rarity} detail={`${owned}/${total}`} page={spreads.indexOf(firstOf(rarity)!) * 2 + 1} onGo={() => onGoTo(firstOf(rarity)!.id)} colour={rarityColour[rarity]} />
        ))}
      </ol>
      <p className="v5-contents-group">Team pages</p>
      <ol className="v5-contents-list">
        {world.teams.map((team) => (
          <ContentsLine key={team.team} label={team.name} detail={`${team.held}/${team.total}`} page={spreads.findIndex(({ id }) => id === `teams/${team.team}`) * 2 + 1} onGo={() => onGoTo(`teams/${team.team}`)} colour="#23251d" />
        ))}
      </ol>
    </div>
  );
}

function ContentsLine({ label, detail, page, colour, onGo }: { label: string; detail: string; page: number; colour: string; onGo: () => void }) {
  return (
    <li>
      <button type="button" className="v5-contents-line" onClick={onGo} style={{ "--rarity": colour } as CSSProperties}>
        <span className="v5-contents-label">{label}</span>
        <span className="v5-contents-dots" />
        <span className="v5-contents-detail">{detail}</span>
        <span className="v5-contents-page">p. {page}</span>
      </button>
    </li>
  );
}

function HoggiePage({ rarity, part, parts, slots, justStuck }: { rarity: Rarity; part: number; parts: number; slots: NumberedHoggie[]; justStuck: string | null }) {
  return (
    <div className="v5-page-inner" style={{ "--rarity": rarityColour[rarity] } as CSSProperties}>
      <header className="v5-page-band">
        <span className="v5-page-band-title">{rarity}</span>
        <span className="v5-print-small">
          page {part} of {parts}
        </span>
      </header>
      <div className="v5-slots">
        {slots.map((hoggie) => (
          <HoggieSlot key={hoggie.hoggie} hoggie={hoggie} stuck={justStuck === hoggie.hoggie} />
        ))}
      </div>
    </div>
  );
}

function HoggieSlot({ hoggie, stuck }: { hoggie: NumberedHoggie; stuck: boolean }) {
  if (hoggie.count === 0)
    return (
      <div className="v5-slot v5-slot-empty" aria-label={`${numberOf(hoggie.number)}, not found yet`}>
        <span className="v5-slot-number">{numberOf(hoggie.number)}</span>
        <HoggieArt slug={hoggie.hoggie} size={58} silhouette />
      </div>
    );
  return (
    <div className="v5-slot">
      <div className={`v5-sticker v5-foil-${hoggie.rarity} ${stuck ? "v5-sticker-stuck" : ""}`} style={{ "--tilt": tiltOf(hoggie.number) } as CSSProperties}>
        <HoggieArt slug={hoggie.hoggie} size={62} />
        <span className="v5-sticker-name">{hoggie.name}</span>
        {hoggie.count > 1 && <span className="v5-sticker-count">×{hoggie.count}</span>}
      </div>
      <span className="v5-slot-number v5-slot-number-under">{numberOf(hoggie.number)}</span>
    </div>
  );
}

function TeamHeaderPage({ page }: { page: Extract<AlbumPage, { kind: "team-header" }> }) {
  const { team, slots } = page;
  return (
    <div className="v5-page-inner v5-team-page">
      <header className="v5-team-header">
        <CrestArt art={team.art} size={78} name={team.name} />
        <div>
          <p className="v5-print-small">{team.mine ? "Your team" : "Team page"}</p>
          <h2 className="v5-team-name">{team.name}</h2>
          <p className="v5-team-count">
            {team.held}/{team.total} stickers {team.complete && <span className="v5-team-complete">complete!</span>}
          </p>
        </div>
      </header>
      <div className="v5-slots v5-slots-three">
        {slots.map((person) => (
          <PersonSlot key={person.key} person={person} />
        ))}
      </div>
    </div>
  );
}

function TeamPage({ page }: { page: Extract<AlbumPage, { kind: "team" }> }) {
  return (
    <div className="v5-page-inner v5-team-page">
      <header className="v5-page-band v5-page-band-team">
        <span className="v5-page-band-title">{page.team.name}</span>
        <span className="v5-print-small">squad, part {page.part + 1}</span>
      </header>
      <div className="v5-slots">
        {page.slots.map((person) => (
          <PersonSlot key={person.key} person={person} />
        ))}
      </div>
    </div>
  );
}

function PersonSlot({ person }: { person: NumberedPerson }) {
  if (!person.held)
    return (
      <div className="v5-slot v5-slot-empty v5-slot-person" aria-label={`${person.name}, thank them to get this sticker`}>
        <span className="v5-slot-number">{numberOf(person.number)}</span>
        <PersonSilhouette />
        <span className="v5-slot-person-name">{person.name}</span>
      </div>
    );
  return (
    <div className="v5-slot v5-slot-person">
      <div className="v5-sticker v5-person-sticker" style={{ "--tilt": tiltOf(person.number) } as CSSProperties}>
        {person.lead && <span className="v5-captain">C</span>}
        <MemberFace face={person.face} className="v5-person-face" />
        <span className="v5-sticker-name">{person.name}</span>
        {person.role !== null && <span className="v5-person-role">{person.role}</span>}
      </div>
    </div>
  );
}

function PersonSilhouette() {
  return (
    <svg viewBox="0 0 40 40" className="v5-person-silhouette" aria-hidden="true">
      <circle cx="20" cy="14" r="8" />
      <path d="M5 38c1-9 7-14 15-14s14 5 15 14z" />
    </svg>
  );
}

function TeamSheetPage({ team }: { team: CollectionTeamPage }) {
  const missing = team.people.filter(({ held }) => !held);
  return (
    <div className="v5-page-inner v5-team-sheet">
      <h2 className="v5-page-title">Team sheet</h2>
      <div className="v5-team-sheet-crest">
        <CrestArt art={team.art} size={120} name={team.name} collected={team.complete} />
        <p className="v5-print-small">{team.complete ? "The crest is yours: every sticker is in." : "Fill every slot to earn the crest."}</p>
      </div>
      {team.leads.length > 0 && (
        <p className="v5-team-sheet-line">
          <strong>Leads</strong> {team.leads.join(", ")}
        </p>
      )}
      {missing.length > 0 && (
        <>
          <p className="v5-contents-group">Still to thank</p>
          <ul className="v5-team-sheet-missing">
            {missing.map((person) => (
              <li key={person.key}>Thank {person.name} to get their sticker</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function NotesPage() {
  return (
    <div className="v5-page-inner v5-notes">
      <h2 className="v5-page-title">Notes</h2>
      <div className="v5-notes-lines" />
      <div className="v5-notes-hog">
        <HedgehogReading size={120} />
      </div>
    </div>
  );
}
