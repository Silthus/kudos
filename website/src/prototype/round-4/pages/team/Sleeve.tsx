// PROTOTYPE (#625, round 4): layout B, the card sleeve: one binder sheet per team with a numbered pocket per person and the team card in the last pocket. Never merge to main.
import { AppLink } from "../../../../AppLink";
import { CrestArt } from "../../../art";
import { useAlbum, type Album, type Person, type Team } from "../../../round-3/album";
import { NextStep } from "./NextStep";
import { BackToTeam, BestMessage, HowTo, Missing, PackedThisWeek } from "./PersonParts";
import { Sticker } from "./Sticker";
import { dateOf, firstNameOf, isCollected, leadsLine, membersOf, personHref, teamHref, teamNamed, teamsOfPerson } from "./team";
import { useLanding } from "./useLanding";

export function SleeveTeam({ team: key }: { team: string }) {
  const { album } = useAlbum();
  const team = teamNamed(album, key);
  const landing = useLanding(team);
  const members = membersOf(album, team);
  return (
    <article className="r4t r4t-b" aria-labelledby="r4t-b-title">
      <header className="r4t-b-head">
        <CrestArt art={team.art} size={64} name={team.name} collected={team.held > 0} />
        <div className="r4t-b-head-words">
          <p className="r4t-eyebrow">{team.mine ? "Your team · " : ""}Sheet {sheetNumberOf(album, team)} of {album.teams.length}</p>
          <h1 id="r4t-b-title" className="r4t-title">
            {team.name}
          </h1>
          <p className="r4t-quiet">{leadsLine(team)}</p>
          <NextStep album={album} team={team} className="r4t-b-next" />
        </div>
        <Pips team={team} />
      </header>
      <ol className="r4t-b-sheet" data-people={members.length}>
        {members.map((person, index) => (
          <li key={person.key} className="r4t-b-pocket">
            <PocketCard person={person} number={index + 1} total={members.length} team={team} landed={landing.person === person.key} />
          </li>
        ))}
        <li className="r4t-b-pocket r4t-b-pocket-team">
          <TeamCard team={team} completed={landing.completed} />
        </li>
      </ol>
    </article>
  );
}

function sheetNumberOf(album: Album, team: Team) {
  return album.teams.findIndex((entry) => entry.team === team.team) + 1;
}

function Pips({ team }: { team: Team }) {
  return (
    <div className={`r4t-b-pips ${team.complete ? "r4t-b-pips-done" : ""}`} role="img" aria-label={`${team.held} of ${team.total} pockets filled`}>
      <span className="r4t-b-pips-row" aria-hidden="true">
        {Array.from({ length: team.total }, (_, index) => (
          <span key={index} className={`r4t-b-pip ${index < team.held ? "r4t-b-pip-in" : ""}`} />
        ))}
      </span>
      <span className="r4t-b-pips-count">
        <strong>{team.held}</strong>/{team.total} pockets
      </span>
    </div>
  );
}

function numberOf(number: number, total: number) {
  return `No. ${String(number).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
}

function PocketCard({ person, number, total, team, landed, size = 112 }: { person: Person; number: number; total: number; team: Team; landed: boolean; size?: number }) {
  const collected = isCollected(person);
  return (
    <AppLink href={personHref(person)} className={`r4t-b-card ${collected ? "" : "r4t-b-card-out"} ${landed ? "r4t-landed" : ""}`}>
      <span className="r4t-b-card-number">{numberOf(number, total)}</span>
      <span className="r4t-b-card-picture">
        <Sticker person={person} collected={collected} size={size} />
      </span>
      <span className="r4t-b-card-name">{person.name}</span>
      <span className="r4t-b-card-role">{collected ? (person.role ?? "Teammate") : `Thank ${firstNameOf(person.name)} to fill`}</span>
      <span className="r4t-b-card-foot">
        <CrestArt art={team.art} size={18} name={team.name} collected={collected} />
        {team.name}
        {person.lead && <span className="r4t-b-card-lead">Lead</span>}
      </span>
    </AppLink>
  );
}

function TeamCard({ team, completed }: { team: Team; completed: boolean }) {
  return (
    <div className={`r4t-b-teamcard ${team.complete ? "r4t-b-teamcard-foil" : ""} ${completed ? "r4t-just-completed" : ""}`}>
      <span className="r4t-b-card-number">Team card</span>
      <CrestArt art={team.art} size={136} name={team.name} collected={team.complete} />
      <span className="r4t-b-card-name">{team.name}</span>
      <span className="r4t-b-teamcard-words">{team.complete ? `Earned ${dateOf(team.completedAt!)}` : `Fill all ${team.total} pockets to earn it`}</span>
      <span className="r4t-b-teamcard-bar" aria-hidden="true">
        <span style={{ width: `${(team.held / team.total) * 100}%` }} />
      </span>
    </div>
  );
}

export function SleevePerson({ person: key }: { person: string }) {
  const { album } = useAlbum();
  const person = album.people.find((entry) => entry.key === key);
  if (person === undefined) return <Missing />;
  const collected = isCollected(person);
  const teams = teamsOfPerson(album, person);
  const home = teams[0];
  return (
    <article className="r4t r4t-b r4t-b-person" aria-labelledby="r4t-b-person">
      <BackToTeam team={home} />
      <div className="r4t-b-pair">
        <div className="r4t-b-front">
          {home !== undefined && <PocketCard person={person} number={membersOf(album, home).indexOf(person) + 1} total={home.total} team={home} landed={false} size={208} />}
        </div>
        <section className="r4t-b-back" aria-labelledby="r4t-b-person">
          <p className="r4t-eyebrow">{collected ? `In your album since ${dateOf(person.collectedAt!)}` : "Empty pocket"}</p>
          <h1 id="r4t-b-person" className="r4t-title">
            {person.name}
          </h1>
          <p className="r4t-quiet">
            {person.role ?? "Teammate"}
            {person.lead ? " · Lead" : ""}
          </p>
          {collected ? <StatsTable person={person} /> : <HowTo album={album} person={person} />}
          <PackedThisWeek album={album} person={person} />
          <BestMessage person={person} className="r4t-b-quote" />
          <ul className="r4t-b-teams" aria-label="Teams">
            {teams.map((team) => (
              <li key={team.team}>
                <AppLink href={teamHref(team)} className="r4t-b-team">
                  <CrestArt art={team.art} size={28} name={team.name} collected={team.held > 0} />
                  <span>{team.name}</span>
                  <span className="r4t-b-team-number">{numberOf(membersOf(album, team).indexOf(person) + 1, team.total)}</span>
                </AppLink>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  );
}

function StatsTable({ person }: { person: Person }) {
  const { stats } = person;
  return (
    <table className="r4t-b-stats">
      <caption>Your history with {firstNameOf(person.name)}</caption>
      <thead>
        <tr>
          <th scope="col" />
          <th scope="col">You gave</th>
          <th scope="col">You got</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Kudos</th>
          <td>{stats.kudosGiven}</td>
          <td>{stats.kudosReceived}</td>
        </tr>
        <tr>
          <th scope="row">Hugs</th>
          <td>{stats.hugsGiven}</td>
          <td>{stats.hugsReceived}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">First thanked</th>
          <td colSpan={2}>{stats.firstThankedAt === null ? "Not yet" : dateOf(stats.firstThankedAt)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
