// PROTOTYPE (#625, round 4): the sidebar: search, your team first, ten teams then "Show more", and the deep pages. Never merge to main.
import { useState } from "react";
import { AppLink } from "../../../AppLink";
import { useAlbum } from "../../round-3/album";
import { hrefOf, type Place } from "../address";

const shownAtFirst = 10;

export function Sidebar({ place }: { place: Place }) {
  const { album } = useAlbum();
  const [search, setSearch] = useState("");
  const [all, setAll] = useState(false);
  const found = album.teams.filter(({ name }) => name.toLowerCase().includes(search.trim().toLowerCase()));
  const shown = all || search !== "" ? found : found.slice(0, shownAtFirst);
  return (
    <nav className="r4-side" aria-label="Album">
      <input type="search" placeholder="Search teams" value={search} onChange={(event) => setSearch(event.target.value)} />
      <ul>
        {shown.map(({ team, name, held, total, mine }) => (
          <li key={team}>
            <AppLink href={hrefOf({ kind: "team", team: mine ? null : team })} aria-current={place.kind === "team" && (place.team === team || (place.team === null && mine)) ? "page" : undefined}>
              {name} {held}/{total}
            </AppLink>
          </li>
        ))}
      </ul>
      {!all && search === "" && found.length > shownAtFirst && (
        <button type="button" onClick={() => setAll(true)}>
          Show {found.length - shownAtFirst} more
        </button>
      )}
      <ul>
        {(["hoggies", "milestones", "activity", "leaderboard"] as const).map((kind) => (
          <li key={kind}>
            <AppLink href={hrefOf({ kind })} aria-current={place.kind === kind ? "page" : undefined}>
              {kind}
            </AppLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
