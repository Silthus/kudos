// PROTOTYPE (#625, round 5): your coolest finds: your rarest hoggies and the people who joined your album last. Never merge to main.
import type { CSSProperties } from "react";
import { AppLink } from "../../../../AppLink";
import { HoggieArt, MemberFace } from "../../../art";
import type { Album, Hoggie, Person } from "../../../round-3/album";
import { whenOf } from "../../../round-3/variant-2-team-yearbook/parts";
import { dateWords, rarityWords } from "../../../round-4/pages/hoggies/shelf";
import { coolestHoggiesOf, hrefs, latestPeopleOf } from "./profile";

export function Finds({ album }: { album: Album }) {
  return (
    <section className="r5p-section" aria-labelledby="r5p-finds-title">
      <div className="r5p-section-head">
        <h2 id="r5p-finds-title" className="r5p-section-title">
          Coolest finds
        </h2>
        <AppLink href={hrefs.hoggies} className="r5p-link">
          All your hoggies →
        </AppLink>
      </div>
      <div className="r5p-finds">
        <ul className="r5p-hoggies" aria-label="Your rarest hoggies">
          {coolestHoggiesOf(album).map((hoggie) => (
            <HoggieCard key={hoggie.hoggie} hoggie={hoggie} />
          ))}
        </ul>
        <LatelyCollected album={album} />
      </div>
    </section>
  );
}

function rarityTint(hoggie: Hoggie) {
  return { "--r5p-rarity": `var(--rarity-${hoggie.rarity})` } as CSSProperties;
}

function HoggieCard({ hoggie }: { hoggie: Hoggie }) {
  return (
    <li>
      <AppLink href={hrefs.hoggie(hoggie)} className="r5p-hoggie" style={rarityTint(hoggie)}>
        <span className="r5p-hoggie-art">
          <HoggieArt slug={hoggie.hoggie} size={96} />
        </span>
        <span className="r5p-hoggie-rarity">{rarityWords[hoggie.rarity]}</span>
        <strong className="r5p-hoggie-name">{hoggie.name}</strong>
        <span className="r5p-hoggie-when r5p-quiet">First found {dateWords(hoggie.firstAt!)}</span>
      </AppLink>
    </li>
  );
}

function LatelyCollected({ album }: { album: Album }) {
  return (
    <div className="r5p-lately">
      <h3 className="r5p-lately-title">New in your album</h3>
      <ul>
        {latestPeopleOf(album).map((person) => (
          <PersonRow key={person.key} album={album} person={person} />
        ))}
      </ul>
    </div>
  );
}

function PersonRow({ album, person }: { album: Album; person: Person }) {
  const team = album.teams.find(({ team: slug }) => slug === person.teams[0]);
  return (
    <li>
      <AppLink href={hrefs.person(person)} className="r5p-person">
        <MemberFace face={person.face} className="r5p-person-face" />
        <span className="r5p-person-words">
          <strong>{person.name}</strong>
          <span className="r5p-quiet">{team?.name ?? person.role ?? "Teammate"}</span>
        </span>
        <span className="r5p-person-when r5p-quiet">{whenOf(person.collectedAt!)}</span>
      </AppLink>
    </li>
  );
}
