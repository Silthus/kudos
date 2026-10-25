import { PrototypeSidebarQuests } from "./questsPrototype/QuestsPrototype";
import { IconCheck, IconRibbon, IconSearch } from "@posthog/icons";
import { useId, useState } from "react";
import { AppLink } from "../AppLink";
import { TeamCrest } from "../crates/TeamCrest";
import { HedgehogSitting } from "../hoggies";
import type { Album, AlbumPerson, AlbumTeam } from "./answer";
import { medalsOf, myTeamOf, plural, progressOf, teamsByProgress } from "./facts";
import { hrefOf, type Place } from "./place";

const shownAtFirst = 10;

export function Sidebar({ album, place }: { album: Album; place: Place }) {
  return (
    <nav className="al-side" aria-label="Album">
      <div className="al-side-panel">
        <TeamsAndPages album={album} place={place} onFollow={stayBeside} />
      </div>
    </nav>
  );
}

function stayBeside() {}

export function TeamsAndPages({ album, place, onFollow }: { album: Album; place: Place; onFollow: () => void }) {
  const [search, setSearch] = useState("");
  const words = search.trim();
  return (
    <>
      <label className="al-search">
        <IconSearch className="al-search-icon" />
        <input type="search" placeholder="Search teams and people" aria-label="Search teams and people" value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <PrototypeSidebarQuests />
      {words === "" ? <Browse album={album} place={place} onFollow={onFollow} /> : <Found album={album} words={words} place={place} onFollow={onFollow} />}
      <DeepPages album={album} place={place} onFollow={onFollow} />
    </>
  );
}

function Browse({ album, place, onFollow }: { album: Album; place: Place; onFollow: () => void }) {
  const [showingAll, setShowingAll] = useState(false);
  const mine = myTeamOf(album);
  const others = teamsByProgress(album.teams);
  const shown = showingAll ? others : withTheCurrentTeam(others.slice(0, shownAtFirst), others, place);
  const hidden = others.length - shown.length;
  return (
    <>
      {mine !== undefined && <MyTeam team={mine} current={isCurrentTeam(place, mine)} onFollow={onFollow} />}
      {others.length > 0 && (
        <section className="al-side-section">
          <h2 className="al-side-heading">
            <span>Teams</span>
            <span>{others.length}</span>
          </h2>
          <TeamList teams={shown} place={place} onFollow={onFollow} />
          {hidden > 0 && (
            <button type="button" className="al-more" onClick={() => setShowingAll(true)}>
              Show {hidden} more
            </button>
          )}
          {showingAll && others.length > shownAtFirst && (
            <button type="button" className="al-more" onClick={() => setShowingAll(false)}>
              Show fewer
            </button>
          )}
        </section>
      )}
    </>
  );
}

function Found({ album, words, place, onFollow }: { album: Album; words: string; place: Place; onFollow: () => void }) {
  const asked = words.toLowerCase();
  const teams = teamsByProgress(album.teams.map((team) => ({ ...team, mine: false }))).filter(({ name }) => name.toLowerCase().includes(asked));
  const people = album.people.filter(({ name }) => name.toLowerCase().includes(asked));
  if (teams.length === 0 && people.length === 0) return <p className="al-nothing">No team or person matches “{words}”.</p>;
  return (
    <section className="al-side-section">
      <h2 className="al-side-heading">
        <span>Matches</span>
        <span>{teams.length + people.length}</span>
      </h2>
      {teams.length > 0 && <TeamList teams={teams} place={place} onFollow={onFollow} />}
      {people.length > 0 && <PersonList people={people} place={place} onFollow={onFollow} />}
    </section>
  );
}

function withTheCurrentTeam(shown: AlbumTeam[], others: AlbumTeam[], place: Place) {
  if (place.kind !== "team" || shown.some(({ team }) => team === place.team)) return shown;
  const current = others.find(({ team }) => team === place.team);
  return current === undefined ? shown : [...shown, current];
}

function isCurrentTeam(place: Place, team: AlbumTeam) {
  return place.kind === "team" && place.team === team.team;
}

function teamHref(team: AlbumTeam) {
  return hrefOf({ kind: "team", team: team.team });
}

function MyTeam({ team, current, onFollow }: { team: AlbumTeam; current: boolean; onFollow: () => void }) {
  const heading = useId();
  return (
    <section className="al-side-section" aria-labelledby={heading}>
      <h2 id={heading} className="al-side-heading">
        Your team
      </h2>
      <AppLink href={teamHref(team)} className="al-mine" aria-current={current ? "page" : undefined} data-state={team.state} data-slot={`team:${team.team}`} onFollow={onFollow}>
        <span className="al-mine-crest">
          <TeamCrest art={team.art} size={40} name={team.name} />
        </span>
        <span className="al-mine-name">{team.name}</span>
        <span className="al-mine-count">{myTeamCountOf(team)}</span>
        <span className="al-bar" aria-hidden="true">
          <span className="al-bar-fill" style={{ width: `${progressOf(team) * 100}%` }} />
        </span>
      </AppLink>
    </section>
  );
}

function myTeamCountOf(team: AlbumTeam) {
  if (team.state === "ready") return "Ready to unlock";
  if (team.state === "unlocked") return "Unlocked";
  return `${team.held} of ${team.total} · ${team.total - team.held} to go`;
}

function TeamList({ teams, place, onFollow }: { teams: AlbumTeam[]; place: Place; onFollow: () => void }) {
  return (
    <ul className="al-teams" aria-label="Teams">
      {teams.map((team) => (
        <li key={team.team}>
          <AppLink href={teamHref(team)} className="al-team" aria-current={isCurrentTeam(place, team) ? "page" : undefined} data-state={team.state} data-slot={`team:${team.team}`} onFollow={onFollow}>
            <span className="al-team-crest">
              <TeamCrest art={team.art} size={22} name={team.name} />
            </span>
            <span className="al-team-name">{team.name}</span> <TeamState team={team} />
          </AppLink>
        </li>
      ))}
    </ul>
  );
}

function TeamState({ team }: { team: AlbumTeam }) {
  if (team.state === "ready")
    return (
      <span className="al-team-ready">
        Ready <span className="al-unseen">to unlock</span>
      </span>
    );
  if (team.state === "unlocked")
    return (
      <span className="al-tick" role="img" aria-label="Unlocked">
        <IconCheck />
      </span>
    );
  return (
    <span className="al-pips" role="img" aria-label={`${team.held} of ${team.total}`}>
      {Array.from({ length: Math.min(team.total, 8) }, (_, index) => (
        <span key={index} className="al-pip" data-held={index < Math.round(progressOf(team) * Math.min(team.total, 8)) ? "" : undefined} />
      ))}
    </span>
  );
}

function PersonList({ people, place, onFollow }: { people: AlbumPerson[]; place: Place; onFollow: () => void }) {
  return (
    <ul className="al-teams" aria-label="People">
      {people.map(({ person, name, held }) => (
        <li key={person}>
          <AppLink href={hrefOf({ kind: "person", person })} className="al-team" data-held={held ? "" : undefined} aria-current={place.kind === "person" && place.person === person ? "page" : undefined} onFollow={onFollow}>
            <span className="al-team-name ph-no-capture">{name}</span>
          </AppLink>
        </li>
      ))}
    </ul>
  );
}

function DeepPages({ album, place, onFollow }: { album: Album; place: Place; onFollow: () => void }) {
  const medals = medalsOf(album);
  return (
    <ul className="al-pages" aria-label="More of your album">
      <li>
        <AppLink href={hrefOf({ kind: "hoggies", hoggie: null })} className="al-page" aria-current={place.kind === "hoggies" ? "page" : undefined} data-slot="hoggies" onFollow={onFollow}>
          <span className="al-page-icon" aria-hidden="true">
            <HedgehogSitting size={20} />
          </span>
          <span>Hoggies</span>
        </AppLink>
      </li>
      <li>
        <AppLink href={hrefOf({ kind: "milestones" })} className="al-page" aria-current={place.kind === "milestones" ? "page" : undefined} onFollow={onFollow}>
          <span className="al-page-icon" aria-hidden="true">
            <IconRibbon />
          </span>
          <span>Milestones</span> <span className="al-page-count">{plural(medals, "medal", "medals")}</span>
        </AppLink>
      </li>
    </ul>
  );
}
