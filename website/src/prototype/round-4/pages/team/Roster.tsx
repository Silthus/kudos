// PROTOTYPE (#625, round 4): layout C, the roster: a team banner with a road of faces that ends at the crest, over a roster table of your history with each person. Never merge to main.
import type { CSSProperties } from "react";
import { AppLink } from "../../../../AppLink";
import { CrestArt } from "../../../art";
import { useAlbum, type Album, type Moment, type Person, type Team } from "../../../round-3/album";
import { NextStep } from "./NextStep";
import { BackToTeam, BestMessage, factsOf, HowTo, Missing, PackedThisWeek } from "./PersonParts";
import { Sticker } from "./Sticker";
import { dateOf, firstNameOf, isCollected, leadsLine, membersOf, personHref, shareOf, teamHref, teamNamed, teamsOfPerson, whenOf } from "./team";
import { useLanding } from "./useLanding";

export function RosterTeam({ team: key }: { team: string }) {
  const { album } = useAlbum();
  const team = teamNamed(album, key);
  const landing = useLanding(team);
  const members = membersOf(album, team);
  return (
    <article className="r4t r4t-c" aria-labelledby="r4t-c-title">
      <header className={`r4t-c-banner ${team.complete ? "r4t-c-banner-done" : ""}`}>
        <CrestArt art={team.art} size={132} name={team.name} collected={team.held > 0} />
        <div className="r4t-c-banner-words">
          <p className="r4t-eyebrow">{team.mine ? "Your team" : "Team"}</p>
          <h1 id="r4t-c-title" className="r4t-c-title">
            {team.name}
          </h1>
          <p className="r4t-quiet">
            {leadsLine(team)} · {team.total} people · {team.held} in your album
          </p>
        </div>
        <Road album={album} team={team} members={members} landed={landing.person} completed={landing.completed} />
      </header>
      <table className="r4t-c-roster">
        <caption className="r4t-sr">The {team.name} roster</caption>
        <thead>
          <tr>
            <th scope="col">Person</th>
            <th scope="col">In your album</th>
            <th scope="col" className="r4t-c-num">Kudos you gave</th>
            <th scope="col" className="r4t-c-num">Kudos you got</th>
            <th scope="col" className="r4t-c-num">Hugs you gave</th>
            <th scope="col" className="r4t-c-num">Hugs you got</th>
          </tr>
        </thead>
        <tbody>
          {members.map((person) => (
            <RosterRow key={person.key} person={person} landed={landing.person === person.key} />
          ))}
        </tbody>
      </table>
    </article>
  );
}

function Road({ album, team, members, landed, completed }: { album: Album; team: Team; members: Person[]; landed: string | null; completed: boolean }) {
  const stops = members.toSorted((first, second) => Number(isCollected(second)) - Number(isCollected(first)));
  return (
    <section className="r4t-c-road" aria-label="Collect the whole team">
      <div className="r4t-c-road-head">
        <p className="r4t-eyebrow">{team.complete ? "Whole team collected" : "Road to the crest"}</p>
        <p className="r4t-c-road-count">
          <strong>{team.held}</strong> of {team.total}
        </p>
      </div>
      <div className="r4t-c-track" style={{ "--r4t-share": shareOf(team) } as CSSProperties}>
        <span className="r4t-c-track-fill" aria-hidden="true" />
        <ol className="r4t-c-stops">
          {stops.map((person) => (
            <li key={person.key} className={`r4t-c-stop ${landed === person.key ? "r4t-landed" : ""}`}>
              <AppLink href={personHref(person)} aria-label={person.name}>
                <Sticker person={person} collected={isCollected(person)} size={44} shape="round" />
              </AppLink>
            </li>
          ))}
          <li className={`r4t-c-stop r4t-c-goal ${team.complete ? "r4t-c-goal-done" : ""} ${completed ? "r4t-just-completed" : ""}`} aria-label={team.complete ? `${team.name} crest, earned` : `${team.name} crest, the reward`}>
            <CrestArt art={team.art} size={60} name={team.name} collected={team.complete} />
          </li>
        </ol>
      </div>
      <NextStep album={album} team={team} className="r4t-c-next" />
    </section>
  );
}

function RosterRow({ person, landed }: { person: Person; landed: boolean }) {
  const collected = isCollected(person);
  const { stats } = person;
  return (
    <tr className={`r4t-c-row ${collected ? "" : "r4t-c-row-out"} ${landed ? "r4t-landed" : ""}`}>
      <th scope="row">
        <AppLink href={personHref(person)} className="r4t-c-person">
          <Sticker person={person} collected={collected} size={48} />
          <span>
            <strong>{person.name}</strong>
            <span className="r4t-c-role">
              {person.role ?? "Teammate"}
              {person.lead ? " · Lead" : ""}
            </span>
          </span>
        </AppLink>
      </th>
      <td data-label="In your album">{collected ? dateOf(person.collectedAt!) : <span className="r4t-c-todo">Thank {firstNameOf(person.name)} in Slack</span>}</td>
      <td data-label="Kudos you gave" className="r4t-c-num">{stats.kudosGiven}</td>
      <td data-label="Kudos you got" className="r4t-c-num">{stats.kudosReceived}</td>
      <td data-label="Hugs you gave" className="r4t-c-num">{stats.hugsGiven}</td>
      <td data-label="Hugs you got" className="r4t-c-num">{stats.hugsReceived}</td>
    </tr>
  );
}

export function RosterPerson({ person: key }: { person: string }) {
  const { album } = useAlbum();
  const person = album.people.find((entry) => entry.key === key);
  if (person === undefined) return <Missing />;
  const collected = isCollected(person);
  const teams = teamsOfPerson(album, person);
  return (
    <article className="r4t r4t-c r4t-c-person-page" aria-labelledby="r4t-c-person">
      <BackToTeam team={teams[0]} />
      <header className="r4t-c-banner r4t-c-banner-person">
        <Sticker person={person} collected={collected} size={132} />
        <div className="r4t-c-banner-words">
          <p className="r4t-eyebrow">{collected ? `In your album since ${dateOf(person.collectedAt!)}` : "Not in your album yet"}</p>
          <h1 id="r4t-c-person" className="r4t-c-title">
            {person.name}
          </h1>
          <p className="r4t-quiet">
            {person.role ?? "Teammate"}
            {person.lead ? " · Lead" : ""}
          </p>
        </div>
      </header>
      {collected ? <StatStrip person={person} /> : <HowTo album={album} person={person} />}
      <PackedThisWeek album={album} person={person} />
      <div className="r4t-c-columns">
        <section aria-labelledby="r4t-c-history">
          <h2 id="r4t-c-history" className="r4t-c-heading">
            Your history with {firstNameOf(person.name)}
          </h2>
          <BestMessage person={person} />
          <History album={album} person={person} />
        </section>
        <section aria-labelledby="r4t-c-teams">
          <h2 id="r4t-c-teams" className="r4t-c-heading">
            Teams
          </h2>
          <ul className="r4t-c-teams">
            {teams.map((team) => (
              <li key={team.team}>
                <AppLink href={teamHref(team)} className="r4t-c-team">
                  <CrestArt art={team.art} size={36} name={team.name} collected={team.held > 0} />
                  <span className="r4t-c-team-name">{team.name}</span>
                  <span className="r4t-c-team-bar" aria-hidden="true">
                    <span style={{ width: `${shareOf(team) * 100}%` }} />
                  </span>
                  <span className="r4t-c-team-count">
                    {team.held}/{team.total}
                  </span>
                </AppLink>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  );
}

function StatStrip({ person }: { person: Person }) {
  return (
    <dl className="r4t-c-strip">
      {factsOf(person).map(({ label, value }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function History({ album, person }: { album: Album; person: Person }) {
  const moments = album.moments.filter((moment) => moment.person === person.key);
  const first = person.stats.firstThankedAt;
  if (moments.length === 0 && first === null) return <p className="r4t-quiet">Nothing between you yet.</p>;
  return (
    <ol className="r4t-c-history">
      {moments.map((moment, index) => (
        <li key={`${moment.kind}-${moment.at}-${index}`}>
          <span className="r4t-c-when">{whenOf(moment.at)}</span>
          <span>{sentenceOf(moment, firstNameOf(person.name))}</span>
        </li>
      ))}
      {first !== null && (
        <li>
          <span className="r4t-c-when">{dateOf(first)}</span>
          <span>You first thanked {firstNameOf(person.name)}.</span>
        </li>
      )}
    </ol>
  );
}

function sentenceOf(moment: Moment, first: string) {
  if (moment.kind === "thoughtful-given") return moment.packed ? `You thanked ${first} and earned a pack.` : `You thanked ${first}.`;
  if (moment.kind === "thoughtful-received") return `${first} thanked you.`;
  if (moment.kind === "hug-given") return `You hugged ${first}.`;
  if (moment.kind === "hug-received") return `${first} hugged you.`;
  return moment.newPerson ? `You opened ${first}'s pack: ${first} joined your album.` : `You opened ${first}'s pack.`;
}
