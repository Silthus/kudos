// PROTOTYPE (#625, round 4): layout A, the class photo: the team stands together in one mounted photo, sealed by its crest once everyone is in. Never merge to main.
import { Fragment } from "react";
import { AppLink } from "../../../../AppLink";
import { CrestArt } from "../../../art";
import { useAlbum, type Person, type Team } from "../../../round-3/album";
import { NextStep } from "./NextStep";
import { BackToTeam, BestMessage, HowTo, Missing, PackedThisWeek, PersonFacts } from "./PersonParts";
import { Sticker } from "./Sticker";
import { dateOf, isCollected, leadsLine, membersOf, personHref, teamHref, teamNamed, teamsOfPerson } from "./team";
import { useLanding } from "./useLanding";

export function ClassPhotoTeam({ team: key }: { team: string }) {
  const { album } = useAlbum();
  const team = teamNamed(album, key);
  const landing = useLanding(team);
  const members = membersOf(album, team);
  return (
    <article className="r4t r4t-a" aria-labelledby="r4t-a-title">
      <header className="r4t-a-head">
        <p className="r4t-eyebrow">{team.mine ? "Your team" : "Team page"}</p>
        <h1 id="r4t-a-title" className="r4t-title">
          {team.name}
        </h1>
        <p className="r4t-quiet">
          {leadsLine(team)} · {team.total} people
        </p>
      </header>
      <figure className="r4t-a-mount">
        <div className="r4t-a-photo" data-size={members.length}>
          {members.map((person) => (
            <PhotoPerson key={person.key} person={person} size={photoSizeOf(members.length)} landed={landing.person === person.key} />
          ))}
        </div>
        <figcaption className="r4t-a-caption">
          <span className="r4t-a-caption-label">Left to right</span> <Caption members={members} />
        </figcaption>
        <Seal team={team} completed={landing.completed} />
      </figure>
      <section className={`r4t-a-goal ${team.complete ? "r4t-a-goal-done" : ""}`} aria-label="Collect the whole team">
        <p className="r4t-eyebrow">{team.complete ? `Sealed ${dateOf(team.completedAt!)}` : "Collect the whole team"}</p>
        <p className="r4t-a-goal-words">
          {team.complete ? `The ${team.name} seal is yours.` : `${team.held} of ${team.total} in your album. The ${team.name} seal sets when the last one lands.`}
        </p>
        <NextStep album={album} team={team} />
      </section>
    </article>
  );
}

function photoSizeOf(people: number) {
  return people >= 6 ? 108 : 128;
}

function PhotoPerson({ person, size, landed }: { person: Person; size: number; landed: boolean }) {
  const collected = isCollected(person);
  return (
    <AppLink href={personHref(person)} className={`r4t-a-person ${collected ? "" : "r4t-a-person-out"} ${landed ? "r4t-landed" : ""}`}>
      <Sticker person={person} collected={collected} size={size} />
      <span className="r4t-a-name">{person.name}</span>
      <span className="r4t-a-role">{collected ? `${person.role ?? "Teammate"}${person.lead ? " · Lead" : ""}` : "Not in your album yet"}</span>
    </AppLink>
  );
}

function Caption({ members }: { members: Person[] }) {
  return members.map((person, index) => (
    <Fragment key={person.key}>
      <span className={isCollected(person) ? "" : "r4t-a-caption-out"}>{person.name}</span>
      {index < members.length - 1 ? ", " : ""}
    </Fragment>
  ));
}

function Seal({ team, completed }: { team: Team; completed: boolean }) {
  return (
    <div className={`r4t-a-seal ${team.complete ? "r4t-a-seal-set" : ""} ${completed ? "r4t-just-completed" : ""}`} aria-label={team.complete ? `${team.name} seal, complete` : `${team.name} seal, ${team.held} of ${team.total}`} role="img">
      <SegmentRing held={team.held} total={team.total} />
      <span className="r4t-a-seal-crest">
        <CrestArt art={team.art} size={84} name={team.name} collected={team.complete} />
      </span>
    </div>
  );
}

function SegmentRing({ held, total }: { held: number; total: number }) {
  const gap = total > 1 ? 10 : 0;
  const sweep = 360 / total;
  return (
    <svg viewBox="0 0 120 120" className="r4t-a-ring" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <path key={index} d={arcOf(index * sweep + gap / 2, (index + 1) * sweep - gap / 2)} className={index < held ? "r4t-a-ring-in" : "r4t-a-ring-out"} />
      ))}
    </svg>
  );
}

function arcOf(fromDegrees: number, toDegrees: number) {
  const radius = 54;
  const [fromX, fromY] = pointAt(fromDegrees, radius);
  const [toX, toY] = pointAt(toDegrees, radius);
  const large = toDegrees - fromDegrees > 180 ? 1 : 0;
  if (toDegrees - fromDegrees >= 359.9) return `M 60 6 A ${radius} ${radius} 0 1 1 59.99 6`;
  return `M ${fromX} ${fromY} A ${radius} ${radius} 0 ${large} 1 ${toX} ${toY}`;
}

function pointAt(degrees: number, radius: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [60 + radius * Math.cos(radians), 60 + radius * Math.sin(radians)] as const;
}

export function ClassPhotoPerson({ person: key }: { person: string }) {
  const { album } = useAlbum();
  const person = album.people.find((entry) => entry.key === key);
  if (person === undefined) return <Missing />;
  const collected = isCollected(person);
  const teams = teamsOfPerson(album, person);
  return (
    <article className="r4t r4t-a r4t-a-entry" aria-labelledby="r4t-a-person">
      <BackToTeam team={teams[0]} />
      <div className="r4t-a-entry-body">
        <figure className="r4t-a-mount r4t-a-mount-single">
          <div className="r4t-a-photo">
            <Sticker person={person} collected={collected} size={232} />
          </div>
          <figcaption className="r4t-a-caption">{collected ? `In your album since ${dateOf(person.collectedAt!)}` : "Not in your album yet"}</figcaption>
        </figure>
        <div className="r4t-a-entry-words">
          <p className="r4t-eyebrow">{person.lead ? "Lead" : "Teammate"}</p>
          <h1 id="r4t-a-person" className="r4t-title">
            {person.name}
          </h1>
          <p className="r4t-quiet">{person.role ?? "Teammate"}</p>
          <TeamSeals teams={teams} />
          <PackedThisWeek album={album} person={person} />
          {collected ? <PersonFacts person={person} /> : <HowTo album={album} person={person} />}
          <BestMessage person={person} />
        </div>
      </div>
    </article>
  );
}

function TeamSeals({ teams }: { teams: Team[] }) {
  return (
    <ul className="r4t-a-seals" aria-label="Teams">
      {teams.map((team) => (
        <li key={team.team}>
          <AppLink href={teamHref(team)} className="r4t-a-seal-link">
            <CrestArt art={team.art} size={36} name={team.name} collected={team.held > 0} />
            <span>
              <strong>{team.name}</strong>
              <span className="r4t-quiet"> {team.held}/{team.total}</span>
            </span>
          </AppLink>
        </li>
      ))}
    </ul>
  );
}
