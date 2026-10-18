// PROTOTYPE (#625, round 3) the yearbook's home: who you've collected, what's waiting, what's next. Never merge to main.
import type { CSSProperties } from "react";
import { AppLink } from "../../../AppLink";
import { CrestArt, HoggieArt } from "../../art";
import { useAlbum, type Album, type Team } from "../album";
import { Count, firstNameOf, listOfNames, rarityWords, Ribbon, teammatesOf } from "./parts";
import { Portrait } from "./Portrait";

export function Home() {
  const { album } = useAlbum();
  return (
    <main className="ty-page">
      <Intro album={album} />
      <PacksWaiting album={album} />
      <Journey album={album} />
      <YourPeople album={album} />
      <Surprises album={album} />
    </main>
  );
}

function Intro({ album }: { album: Album }) {
  return (
    <section className="ty-intro">
      <p className="ty-eyebrow">Your yearbook</p>
      <h1 className="ty-topline">
        <span>{album.me.name}</span>
        <span className="ty-dot" aria-hidden="true">·</span>
        <span className="ty-level">Level {album.level.level}</span>
        <span className="ty-dot" aria-hidden="true">·</span>
        <span>
          {album.collected} people collected
        </span>
      </h1>
      <p className="ty-lede">Thank a teammate in Slack and say why. They join your yearbook, page by page, team by team.</p>
    </section>
  );
}

function PacksWaiting({ album }: { album: Album }) {
  const names = album.packs.flatMap(({ person }) => album.people.filter(({ key }) => key === person)).map(({ name }) => firstNameOf(name));
  if (album.packs.length === 0)
    return (
      <section className="ty-packs-card ty-packs-quiet">
        <EnvelopeStack count={0} />
        <div className="ty-packs-words">
          <h2 className="ty-packs-title">No packs waiting</h2>
          <p className="ty-muted">Your next thoughtful kudos earns one: a portrait for your yearbook and a surprise hoggie.</p>
        </div>
      </section>
    );
  return (
    <AppLink href="/book#packs" className="ty-packs-card">
      <EnvelopeStack count={album.packs.length} />
      <div className="ty-packs-words">
        <h2 className="ty-packs-title">
          {album.packs.length === 1 ? "1 pack" : `${album.packs.length} packs`} from your thank-yous: {listOfNames(names)}
        </h2>
        <p className="ty-packs-sub">Each holds a teammate's portrait and a surprise hoggie.</p>
      </div>
      <span className="ty-button ty-button-warm">Open</span>
    </AppLink>
  );
}

function EnvelopeStack({ count }: { count: number }) {
  return (
    <span className={`ty-envelope-stack ${count === 0 ? "ty-envelope-stack-empty" : ""}`} aria-hidden="true">
      {count > 1 && <span className="ty-mini-envelope ty-mini-envelope-back" />}
      <span className="ty-mini-envelope">
        <span className="ty-mini-seal" />
      </span>
    </span>
  );
}

function Journey({ album }: { album: Album }) {
  const done = album.journey.filter((step) => step.done).length;
  if (done === album.journey.length) return null;
  return (
    <section className="ty-journey" aria-labelledby="ty-journey-title">
      <h2 id="ty-journey-title" className="ty-journey-title">
        Getting started <span className="ty-muted">· {done} of {album.journey.length}</span>
      </h2>
      <ol className="ty-journey-steps">
        {album.journey.map((step) => (
          <li key={step.step} className={`ty-journey-step ${step.done ? "ty-journey-done" : ""}`}>
            <span className="ty-journey-mark" aria-hidden="true">
              {step.done ? "✓" : ""}
            </span>
            <span>
              <span className="ty-sr">{step.done ? "Done: " : "Next: "}</span>
              {step.goal}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const portraitsPerRow = 10;

function closestFirst(first: Team, second: Team) {
  return Number(second.mine) - Number(first.mine) || Number(first.complete) - Number(second.complete) || first.total - first.held - (second.total - second.held);
}

function YourPeople({ album }: { album: Album }) {
  const total = album.people.length;
  return (
    <section className="ty-people" aria-labelledby="ty-people-title">
      <div className="ty-section-head">
        <h2 id="ty-people-title" className="ty-section-title">
          Your people
        </h2>
        <span className="ty-muted">
          {album.collected} of {total} collected
        </span>
        <AppLink href="/book" className="ty-link ty-push-right">
          Open the album →
        </AppLink>
      </div>
      <p className="ty-people-hint">
        <span className="ty-hint-swatch" aria-hidden="true" /> Grey faces are teammates you haven't thanked yet. Thank them to add them.
      </p>
      <ul className="ty-team-rows">
        {album.teams.toSorted(closestFirst).map((team) => (
          <TeamRow key={team.team} album={album} team={team} />
        ))}
      </ul>
    </section>
  );
}

function TeamRow({ album, team }: { album: Album; team: Team }) {
  const teammates = teammatesOf(album, team);
  const overflow = teammates.length > portraitsPerRow ? teammates.length - (portraitsPerRow - 1) : 0;
  const shown = overflow > 0 ? teammates.slice(0, portraitsPerRow - 1) : teammates;
  return (
    <li className="ty-team-row" data-team={team.team}>
      <AppLink href={`/book#teams/${team.team}`} className="ty-team-label">
        <CrestArt art={team.art} size={48} name={team.name} collected={team.held > 0} />
        <span className="ty-team-label-words">
          <span className="ty-team-name">{team.name}</span>
          <span className="ty-team-meta">
            <Count team={team} />
            {team.complete && <Ribbon small />}
          </span>
        </span>
      </AppLink>
      <ul className="ty-team-faces" aria-label={`${team.name} teammates`}>
        {shown.map(({ person, collected }) => (
          <li key={person.key}>
            <AppLink href={`/book#people/${person.key}`} className="ty-face-link" title={collected ? person.name : `${person.name}: thank them to add them`}>
              <Portrait face={person.face} name={person.name} collected={collected} size={60} />
              <span className={`ty-face-name ${collected ? "" : "ty-face-name-out"}`}>{firstNameOf(person.name)}</span>
            </AppLink>
          </li>
        ))}
        {overflow > 0 && (
          <li>
            <AppLink href={`/book#teams/${team.team}`} className="ty-face-link">
              <span className="ty-more">+{overflow}</span>
              <span className="ty-face-name ty-face-name-out">more</span>
            </AppLink>
          </li>
        )}
      </ul>
    </li>
  );
}

const shelfSize = 7;

function Surprises({ album }: { album: Album }) {
  const latest = album.hoggies.filter(({ count }) => count > 0).toSorted((first, second) => (second.firstAt ?? 0) - (first.firstAt ?? 0)).slice(0, shelfSize);
  return (
    <section className="ty-surprises" aria-labelledby="ty-surprises-title">
      <div className="ty-section-head">
        <h2 id="ty-surprises-title" className="ty-section-title ty-section-title-small">
          Surprises
        </h2>
        <span className="ty-muted">
          {album.hoggiesFound}/{album.hoggies.length} hoggies found
        </span>
        <AppLink href="/book#hoggies" className="ty-link ty-push-right">
          All hoggies →
        </AppLink>
      </div>
      <ul className="ty-shelf">
        {latest.map((hoggie) => (
          <li key={hoggie.hoggie} className="ty-shelf-item" style={{ "--ty-rarity": `var(--rarity-${hoggie.rarity})` } as CSSProperties}>
            <HoggieArt slug={hoggie.hoggie} size={64} />
            <span className="ty-shelf-name">{hoggie.name}</span>
            <span className="ty-shelf-rarity">{rarityWords[hoggie.rarity]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
