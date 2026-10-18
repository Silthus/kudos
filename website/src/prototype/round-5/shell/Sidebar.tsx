// PROTOTYPE (#625, round 5): the sidebar: search, your team first, ten teams by progress then "Show more", and the deep pages. Never merge to main.
import { IconCheck, IconChevronDown, IconCrown, IconPulse, IconRibbon, IconSearch } from "@posthog/icons";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppLink } from "../../../AppLink";
import { HedgehogSitting } from "../../../hoggies";
import { CrestArt } from "../../art";
import { useAlbum, type Album, type Team } from "../../round-3/album";
import { hrefOf, type Place } from "../address";
import { myWeeklyRankOf } from "../../round-4/pages/leaderboard/board";
import { useHeldHoggiesFound, useHoggieLandings } from "./trayState";

const shownAtFirst = 10;

const weekMs = 7 * 86_400_000;

const landedFlashMs = 1600;

type Found = { team: Team; matchedPerson: string | null };

export function Sidebar({ place }: { place: Place }) {
  const { album } = useAlbum();
  const [search, setSearch] = useState("");
  const [showingAll, setShowingAll] = useState(false);
  const [open, setOpen] = useState(false);
  const mine = album.teams.find((team) => team.mine)!;
  const searching = search.trim() !== "";
  const found = foundTeams(album, search);
  const shown = searching || showingAll ? found : withTheCurrentTeam(found.slice(0, shownAtFirst), found, place);
  const hidden = found.length - shown.length;
  const close = () => setOpen(false);
  return (
    <nav className="r5-side" aria-label="Album" data-open={open ? "" : undefined}>
      <button type="button" className="r5-side-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        Teams and pages
        <IconChevronDown />
      </button>
      <div className="r5-side-panel">
        <label className="r5-search">
          <IconSearch className="r5-search-icon" />
          <input type="search" placeholder="Search teams and people" aria-label="Search teams and people" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        {!searching && (
          <section aria-labelledby="r5-side-mine">
            <h2 id="r5-side-mine" className="r5-side-heading">
              Your team
            </h2>
            <MyTeam team={mine} current={isCurrentTeam(place, mine)} onFollow={close} />
          </section>
        )}
        <section aria-labelledby="r5-side-teams">
          <h2 id="r5-side-teams" className="r5-side-heading">
            <span>{searching ? "Matches" : "Teams"}</span>
            <span>{searching ? found.length : album.teams.length - 1}</span>
          </h2>
          <ul className="r5-teams">
            {shown.map(({ team, matchedPerson }) => (
              <li key={team.team}>
                <TeamRow team={team} matchedPerson={matchedPerson} current={isCurrentTeam(place, team)} onFollow={close} />
              </li>
            ))}
          </ul>
          {searching && found.length === 0 && <p className="r5-nothing">No team or person matches “{search.trim()}”.</p>}
          {!searching && hidden > 0 && (
            <button type="button" className="r5-more" onClick={() => setShowingAll(true)}>
              Show {hidden} more
            </button>
          )}
          {!searching && showingAll && (
            <button type="button" className="r5-more" onClick={() => setShowingAll(false)}>
              Show fewer
            </button>
          )}
        </section>
        <DeepPages album={album} place={place} onFollow={close} />
      </div>
    </nav>
  );
}

function foundTeams(album: Album, search: string): Found[] {
  const words = search.trim().toLowerCase();
  const others = album.teams.filter((team) => !team.mine).toSorted(byProgress);
  if (words === "") return others.map((team) => ({ team, matchedPerson: null }));
  return album.teams.flatMap((team): Found[] => {
    if (team.name.toLowerCase().includes(words)) return [{ team, matchedPerson: null }];
    const person = album.people.find(({ key, name }) => team.people.includes(key) && name.toLowerCase().includes(words));
    return person === undefined ? [] : [{ team, matchedPerson: person.name }];
  });
}

function byProgress(first: Team, second: Team) {
  return second.held / second.total - first.held / first.total || first.name.localeCompare(second.name);
}

function withTheCurrentTeam(shown: Found[], found: Found[], place: Place) {
  if (place.kind !== "team" || place.team === null || shown.some(({ team }) => team.team === place.team)) return shown;
  const current = found.find(({ team }) => team.team === place.team);
  return current === undefined ? shown : [...shown, current];
}

function isCurrentTeam(place: Place, team: Team) {
  return place.kind === "team" && (place.team === team.team || (place.team === null && team.mine));
}

function teamHref(team: Team) {
  return team.mine ? hrefOf({ kind: "team", team: null }) : hrefOf({ kind: "team", team: team.team });
}

function useFlashWhenItRises(value: number) {
  const [flashing, setFlashing] = useState(false);
  const before = useRef(value);
  useEffect(() => {
    const rose = value > before.current;
    before.current = value;
    if (!rose) return;
    setFlashing(true);
    const timer = window.setTimeout(() => setFlashing(false), landedFlashMs);
    return () => window.clearTimeout(timer);
  }, [value]);
  return flashing ? "" : undefined;
}

function JustLanded() {
  return (
    <span className="r5-just-landed" aria-hidden="true">
      +1
    </span>
  );
}

function MyTeam({ team, current, onFollow }: { team: Team; current: boolean; onFollow: () => void }) {
  const left = team.total - team.held;
  const landed = useFlashWhenItRises(team.held);
  return (
    <AppLink href={teamHref(team)} className="r5-mine" aria-current={current ? "page" : undefined} data-complete={team.complete ? "" : undefined} data-landed={landed} onFollow={onFollow}>
      {landed !== undefined && <JustLanded />}
      <span className="r5-mine-crest">
        <CrestArt art={team.art} size={40} />
      </span>
      <span className="r5-mine-name">{team.name}</span>
      <span className="r5-mine-count">{team.complete ? "Complete" : `${team.held} of ${team.total} · ${left} to go`}</span>
      <span className="r5-mine-bar" aria-hidden="true">
        <span className="r5-mine-fill" style={{ width: `${(team.held / team.total) * 100}%` }} />
      </span>
    </AppLink>
  );
}

function TeamRow({ team, matchedPerson, current, onFollow }: { team: Team; matchedPerson: string | null; current: boolean; onFollow: () => void }) {
  const landed = useFlashWhenItRises(team.held);
  return (
    <AppLink href={teamHref(team)} className="r5-team" aria-current={current ? "page" : undefined} data-landed={landed} onFollow={onFollow}>
      {landed !== undefined && <JustLanded />}
      <span className="r5-team-crest">
        <CrestArt art={team.art} size={22} />
      </span>
      <span className="r5-team-name">
        <span>{team.name}</span>
        {matchedPerson !== null && <span className="r5-team-match">{matchedPerson}</span>}
      </span>
      {team.complete ? (
        <span className="r5-tick" role="img" aria-label="Complete">
          <IconCheck />
        </span>
      ) : (
        <Pips held={team.held} total={team.total} />
      )}
    </AppLink>
  );
}

function Pips({ held, total }: { held: number; total: number }) {
  return (
    <span className="r5-pips" role="img" aria-label={`${held} of ${total} collected`}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className="r5-pip" data-held={index < held ? "" : undefined} />
      ))}
    </span>
  );
}

type DeepPage = { kind: "hoggies" | "milestones" | "activity" | "leaderboard"; label: string; icon: ReactNode; count: string };

function DeepPages({ album, place, onFollow }: { album: Album; place: Place; onFollow: () => void }) {
  const hoggiesFound = useHeldHoggiesFound() ?? album.hoggiesFound;
  const hoggieLanded = useFlashWhenItRises(useHoggieLandings());
  return (
    <ul className="r5-pages" aria-label="More of your album">
      {deepPagesOf(album, hoggiesFound).map(({ kind, label, icon, count }) => (
        <li key={kind}>
          <AppLink href={hrefOf({ kind })} className="r5-page" data-side-page={kind} data-landed={kind === "hoggies" ? hoggieLanded : undefined} aria-current={place.kind === kind ? "page" : undefined} onFollow={onFollow}>
            <span className="r5-page-icon" aria-hidden="true">
              {icon}
            </span>
            <span>{label}</span>
            <span key={count} className="r5-page-count">
              {count}
            </span>
          </AppLink>
        </li>
      ))}
    </ul>
  );
}

function deepPagesOf(album: Album, hoggiesFound: number): DeepPage[] {
  const medals = album.milestones.flatMap(({ tiers }) => tiers).filter(({ earnedAt }) => earnedAt !== null).length;
  const thisWeek = album.moments.filter(({ at }) => at > Date.now() - weekMs).length;
  const rank = myWeeklyRankOf(album) ?? undefined;
  return [
    { kind: "hoggies", label: "Hoggies", icon: <HedgehogSitting size={20} />, count: `${hoggiesFound}/${album.hoggies.length}` },
    { kind: "milestones", label: "Milestones", icon: <IconRibbon />, count: `${medals} medals` },
    { kind: "activity", label: "Activity", icon: <IconPulse />, count: `${thisWeek} this week` },
    { kind: "leaderboard", label: "Leaderboard", icon: <IconCrown />, count: rank === undefined ? "" : `#${rank}` },
  ];
}
