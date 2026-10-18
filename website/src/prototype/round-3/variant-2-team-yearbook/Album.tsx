// PROTOTYPE (#625, round 3) the yearbook album: a sticky team index beside one fixed-size page. Never merge to main.
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { AppLink, useNavigate } from "../../../AppLink";
import { CrestArt, HoggieArt } from "../../art";
import { useAlbum, type Album as AlbumData, type Person, type Team } from "../album";
import { hrefOfSpot, spotOf, useHash, type Spot } from "./address";
import { PackPlace } from "./PackOpening";
import { Count, dateOf, firstNameOf, isShiny, listOfNames, ProgressRing, rarityOrder, rarityWords, Ribbon, teammatesOf } from "./parts";
import { Portrait } from "./Portrait";

export function Album() {
  const { album } = useAlbum();
  const { hash, flipTo } = useHash();
  const spot = shownSpotOf(spotOf(hash), album);
  useArrowFlips(spot, album, flipTo);
  const leaf = useRef<HTMLDivElement>(null);
  const spotKey = hrefOfSpot(spot);
  useLayoutEffect(() => {
    leaf.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [spotKey]);
  return (
    <main className="ty-album">
      <AlbumIndex album={album} spot={spot} flipTo={flipTo} />
      <div ref={leaf} className="ty-leaf" data-spot={spot.kind}>
        {spot.kind === "team" && <TeamPage album={album} team={album.teams.find(({ team }) => team === spot.team)!} />}
        {spot.kind === "person" && <PersonPage album={album} person={album.people.find(({ key }) => key === spot.key)} />}
        {spot.kind === "hoggies" && <HoggiesPage album={album} rarity={spot.rarity} flipTo={flipTo} />}
        {spot.kind === "packs" && <PackPlace />}
      </div>
    </main>
  );
}

function shownSpotOf(spot: Spot, album: AlbumData): Spot {
  if (spot.kind !== "team") return spot;
  const known = album.teams.some(({ team }) => team === spot.team);
  return { kind: "team", team: known ? spot.team : album.teams[0]!.team };
}

function useArrowFlips(spot: Spot, album: AlbumData, flipTo: (href: string) => void) {
  useEffect(() => {
    if (spot.kind !== "team") return;
    const flip = (event: KeyboardEvent) => {
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.target instanceof HTMLElement && event.target.closest("input, select, textarea") !== null) return;
      const at = album.teams.findIndex(({ team }) => team === spot.team);
      const next = album.teams[at + (event.key === "ArrowRight" ? 1 : -1)];
      if (next === undefined) return;
      event.preventDefault();
      flipTo(`/book#teams/${next.team}`);
    };
    window.addEventListener("keydown", flip);
    return () => window.removeEventListener("keydown", flip);
  }, [spot, album.teams, flipTo]);
}

function AlbumIndex({ album, spot, flipTo }: { album: AlbumData; spot: Spot; flipTo: (href: string) => void }) {
  const onPerson = spot.kind === "person" ? album.people.find(({ key }) => key === spot.key) : undefined;
  return (
    <nav aria-label="Album contents" className="ty-index">
      <p className="ty-eyebrow">Contents</p>
      {(album.packs.length > 0 || spot.kind === "packs") && (
        <IndexLink href="/book#packs" current={spot.kind === "packs"} sameSection={false} flipTo={flipTo} className="ty-index-packs">
          <span className="ty-index-envelope" aria-hidden="true" />
          <span className="ty-index-name">{album.packs.length > 0 ? "Packs waiting" : "Packs"}</span>
          {album.packs.length > 0 && <span className="ty-index-badge">{album.packs.length}</span>}
        </IndexLink>
      )}
      <p className="ty-index-heading">Team pages</p>
      <ul className="ty-index-list">
        {album.teams.map((team) => (
          <li key={team.team}>
            <IndexLink href={`/book#teams/${team.team}`} current={(spot.kind === "team" && spot.team === team.team) || (onPerson?.teams[0] === team.team)} sameSection={spot.kind === "team"} flipTo={flipTo}>
              <CrestArt art={team.art} size={26} name={team.name} collected={team.held > 0} />
              <span className="ty-index-name">{team.name}</span>
              {team.complete && <span className="ty-index-ribbon" aria-label="Complete">★</span>}
              <span className="ty-index-count">
                {team.held}/{team.total}
              </span>
            </IndexLink>
          </li>
        ))}
      </ul>
      <p className="ty-index-heading">Surprises</p>
      <IndexLink href="/book#hoggies" current={spot.kind === "hoggies"} sameSection={false} flipTo={flipTo}>
        <HoggieArt slug={album.hoggies.find(({ count }) => count > 0)?.hoggie ?? album.hoggies[0]!.hoggie} size={26} />
        <span className="ty-index-name">Hoggies</span>
        <span className="ty-index-count">
          {album.hoggiesFound}/{album.hoggies.length}
        </span>
      </IndexLink>
      <AppLink href="/book/earned" className="ty-index-link ty-index-quiet">
        <span className="ty-index-name">Milestones →</span>
      </AppLink>
      <p className="ty-index-tip">Use ← → to turn team pages.</p>
    </nav>
  );
}

function IndexLink({ href, current, sameSection, flipTo, className = "", children }: { href: string; current: boolean; sameSection: boolean; flipTo: (href: string) => void; className?: string; children: ReactNode }) {
  const navigate = useNavigate();
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (sameSection) flipTo(href);
    else navigate(href);
  };
  return (
    <a href={href} onClick={follow} aria-current={current ? "page" : undefined} className={`ty-index-link ${className}`}>
      {children}
    </a>
  );
}

function TeamPage({ album, team }: { album: AlbumData; team: Team }) {
  const teammates = teammatesOf(album, team);
  return (
    <article className="ty-team-page" aria-labelledby="ty-team-title">
      <header className="ty-team-head">
        <CrestArt art={team.art} size={92} name={team.name} collected={team.held > 0} />
        <div className="ty-team-head-words">
          <p className="ty-eyebrow">Team page{team.mine ? " · your team" : ""}</p>
          <h1 id="ty-team-title" className="ty-title">
            {team.name}
          </h1>
          <p className="ty-muted">
            {team.leads.length > 0 ? `Led by ${listOfNames(team.leads)} · ` : ""}
            {team.held} of {team.total} in your album
          </p>
        </div>
        <div className="ty-team-head-side">
          <ProgressRing held={team.held} total={team.total} size={72} />
          {team.complete && <Ribbon />}
        </div>
      </header>
      <ul className="ty-grid">
        {teammates.map(({ person, collected }) => (
          <li key={person.key}>
            <AppLink href={`/book#people/${person.key}`} className={`ty-card ${collected ? "" : "ty-card-out"}`} data-person={person.key}>
              <Portrait face={person.face} name={person.name} collected={collected} size={104} />
              <span className="ty-card-name">{person.name}</span>
              <span className="ty-card-role">{collected ? (person.role ?? "Teammate") : "Thank them to add them"}</span>
              {person.lead && collected && <span className="ty-tag">Lead</span>}
            </AppLink>
          </li>
        ))}
      </ul>
    </article>
  );
}

function PersonPage({ album, person }: { album: AlbumData; person: Person | undefined }) {
  if (person === undefined)
    return (
      <article className="ty-person">
        <h1 className="ty-title">Nobody here yet</h1>
        <p className="ty-muted">This teammate isn't on any team page.</p>
      </article>
    );
  const collected = person.collectedAt !== null;
  const teams = person.teams.flatMap((key) => album.teams.filter(({ team }) => team === key));
  const pack = album.packs.find((entry) => entry.person === person.key);
  const first = firstNameOf(person.name);
  return (
    <article className="ty-person" aria-labelledby="ty-person-title">
      <AppLink href={`/book#teams/${teams[0]?.team ?? ""}`} className="ty-link ty-back">
        ← {teams[0]?.name ?? "Album"}
      </AppLink>
      <div className="ty-person-entry">
        <Portrait face={person.face} name={person.name} collected={collected} size={208} />
        <div className="ty-person-words">
          <p className="ty-eyebrow">{collected ? `In your album since ${dateOf(person.collectedAt!)}` : "Not in your album yet"}</p>
          <h1 id="ty-person-title" className="ty-title ty-title-big">
            {person.name}
          </h1>
          <p className="ty-person-role">
            {person.role ?? "Teammate"}
            {person.lead ? " · Lead" : ""}
          </p>
          <ul className="ty-person-teams" aria-label="Teams">
            {teams.map((team) => (
              <li key={team.team}>
                <AppLink href={`/book#teams/${team.team}`} className="ty-chip">
                  <CrestArt art={team.art} size={20} name={team.name} collected={team.held > 0} />
                  {team.name}
                  <Count team={team} />
                </AppLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {!collected && (
        <div className="ty-howto">
          {pack !== undefined ? (
            <>
              <p>
                <strong>{first}'s pack is waiting.</strong> Open it to add them to your album.
              </p>
              <AppLink href="/book#packs" className="ty-button ty-button-warm">
                Open the pack
              </AppLink>
            </>
          ) : (
            <p>
              <strong>Give them a thoughtful kudos</strong>: thank {first} in Slack and say why. Their portrait arrives in your next pack.
            </p>
          )}
        </div>
      )}
      <section aria-label={`Your history with ${first}`} className="ty-history">
        <h2 className="ty-history-title">Your history with {first}</h2>
        <dl className="ty-stats">
          <Stat label="First thanked" value={person.stats.firstThankedAt === null ? "Not yet" : dateOf(person.stats.firstThankedAt)} />
          <Stat label="Kudos you gave" value={person.stats.kudosGiven} />
          <Stat label={`Kudos ${first} gave you`} value={person.stats.kudosReceived} />
          <Stat label="Hugs you gave" value={person.stats.hugsGiven} />
          <Stat label={`Hugs ${first} gave you`} value={person.stats.hugsReceived} />
        </dl>
        {person.stats.bestMessage !== null && (
          <figure className="ty-quote">
            <blockquote>“{person.stats.bestMessage}”</blockquote>
            <figcaption>Your best thank-you to {first}</figcaption>
          </figure>
        )}
      </section>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="ty-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function HoggiesPage({ album, rarity, flipTo }: { album: AlbumData; rarity: AlbumData["hoggies"][number]["rarity"] | null; flipTo: (href: string) => void }) {
  const shown = album.hoggies.filter((hoggie) => rarity === null || hoggie.rarity === rarity).toSorted((first, second) => rarityOrder.indexOf(first.rarity) - rarityOrder.indexOf(second.rarity) || Number(second.count > 0) - Number(first.count > 0));
  const tabs = [null, ...rarityOrder] as const;
  return (
    <article className="ty-hoggies" aria-labelledby="ty-hoggies-title">
      <header className="ty-hoggies-head">
        <p className="ty-eyebrow">Surprises</p>
        <h1 id="ty-hoggies-title" className="ty-title">
          Hoggies
        </h1>
        <p className="ty-muted">
          Every pack hides one. {album.hoggiesFound} of {album.hoggies.length} found.
        </p>
      </header>
      <div className="ty-tabs" role="group" aria-label="Rarity">
        {tabs.map((tab) => {
          const ofTab = album.hoggies.filter((hoggie) => tab === null || hoggie.rarity === tab);
          const href = hrefOfSpot({ kind: "hoggies", rarity: tab });
          return (
            <a
              key={tab ?? "all"}
              href={href}
              aria-current={tab === rarity ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                flipTo(href);
              }}
              className="ty-tab"
              style={tab === null ? undefined : ({ "--ty-rarity": `var(--rarity-${tab})` } as CSSProperties)}
            >
              {tab === null ? "All" : rarityWords[tab]}
              <span className="ty-tab-count">
                {ofTab.filter(({ count }) => count > 0).length}/{ofTab.length}
              </span>
            </a>
          );
        })}
      </div>
      <ul className="ty-hoggie-grid">
        {shown.map((hoggie) => (
          <li key={hoggie.hoggie} className={`ty-hoggie ${hoggie.count > 0 ? "" : "ty-hoggie-out"} ${isShiny(hoggie.rarity) && hoggie.count > 0 ? "ty-hoggie-shiny" : ""}`} style={{ "--ty-rarity": `var(--rarity-${hoggie.rarity})` } as CSSProperties}>
            <HoggieArt slug={hoggie.hoggie} size={64} silhouette={hoggie.count === 0} />
            <span className="ty-hoggie-name">{hoggie.count > 0 ? hoggie.name : "Not found yet"}</span>
            <span className="ty-hoggie-rarity">
              {rarityWords[hoggie.rarity]}
              {hoggie.count > 1 ? ` · ×${hoggie.count}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
