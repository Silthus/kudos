// PROTOTYPE (#625, round 6): the class photo: the team stands together in one mounted photo, and its team sticker waits for you to unlock it once everyone is in. Never merge to main.
import { Fragment, useCallback, useRef, useState, type CSSProperties } from "react";
import { AppLink } from "../../../../AppLink";
import { CrestArt } from "../../../art";
import { EmojiArt } from "../../shell/EmojiArt";
import { useAlbum, type Album, type Emoji, type Person, type Team } from "../../../round-3/album";
import { initialsOf } from "../../../round-3/variant-2-team-yearbook/Portrait";
import { NextStep } from "./NextStep";
import { BackToTeam, BestMessage, HowTo, HypeEmoji, Missing, PackedThisWeek, PersonFacts } from "./PersonParts";
import { Silhouette, Sticker } from "./Sticker";
import { TeamSticker, type SealMotion } from "./TeamSticker";
import { dateOf, isCollected, leadsLine, membersOf, personHref, stickerStateOf, teamEmojiOf, teamHref, teamNamed, teamsOfPerson } from "./team";
import { UnlockMoment } from "./UnlockMoment";
import { useLanding, type Landing } from "./useLanding";

type Unlocking = "idle" | "playing" | "home";

export function ClassPhotoTeam({ team: key }: { team: string }) {
  const { album } = useAlbum();
  const team = teamNamed(album, key);
  const landing = useLanding(team);
  const members = membersOf(album, team);
  const emoji = teamEmojiOf(album, team);
  const seal = useRef<HTMLElement>(null);
  const [unlocking, setUnlocking] = useState<Unlocking>("idle");
  const unlock = useCallback(() => setUnlocking("playing"), []);
  const settle = useCallback(() => setUnlocking("home"), []);
  const homeOf = useCallback(() => seal.current, []);
  return (
    <article className="r6t r6t-a" aria-labelledby="r6t-a-title">
      <header className="r6t-a-head">
        <p className="r6t-eyebrow">{team.mine ? "Your team" : "Team page"}</p>
        <h1 id="r6t-a-title" className="r6t-title">
          {team.name}
        </h1>
        <p className="r6t-quiet">
          {leadsLine(team)} · {team.total} people
        </p>
      </header>
      <figure className="r6t-a-mount">
        <div className="r6t-a-photo" data-size={members.length}>
          {members.map((person) => (
            <PhotoPerson key={person.key} person={person} size={photoSizeOf(members.length)} landed={landing.person === person.key} />
          ))}
        </div>
        <figcaption className="r6t-a-caption">
          <span className="r6t-a-caption-label">Left to right</span> <Caption members={members} />
        </figcaption>
        <TeamSticker team={team} emoji={emoji} motion={sealMotionOf(team, landing, unlocking)} onUnlock={unlock} seal={seal} />
      </figure>
      <Goal album={album} team={team} emoji={emoji} landing={landing} onUnlock={unlock} />
      {unlocking === "playing" && <UnlockMoment team={team} homeOf={homeOf} onDone={settle} />}
    </article>
  );
}

function sealMotionOf(team: Team, landing: Landing, unlocking: Unlocking): SealMotion {
  const landedHere = landing.person !== null && team.people.includes(landing.person);
  return { landedSegment: landedHere && !team.complete ? team.held - 1 : null, readyArrives: landing.completed, justHome: unlocking === "home", away: unlocking === "playing" };
}

function Goal({ album, team, emoji, landing, onUnlock }: { album: Album; team: Team; emoji: Emoji | undefined; landing: Landing; onUnlock: () => void }) {
  const state = stickerStateOf(team);
  const ticking = landing.person !== null && team.people.includes(landing.person);
  return (
    <section className={`r6t-a-goal r6t-a-goal-${state} ${landing.completed ? "r6t-a-goal-arrives" : ""}`} aria-label="The team sticker">
      <p className="r6t-eyebrow">{goalEyebrowOf(team)}</p>
      <p className="r6t-a-goal-words">
        {state === "unlocked" ? (
          `The ${team.name} sticker is yours.`
        ) : (
          <>
            <span key={team.held} className={ticking ? "r6t-tick" : ""}>
              {team.held}
            </span>{" "}
            of {team.total} in your album. {state === "ready" ? "Everyone is in." : `Collect all ${team.total} to unlock the ${team.name} sticker.`}
          </>
        )}
      </p>
      <NextStep album={album} team={team} onUnlock={onUnlock} />
      {state === "unlocked" && emoji !== undefined && <TeamEmojiLine album={album} emoji={emoji} />}
    </section>
  );
}

function goalEyebrowOf(team: Team) {
  const state = stickerStateOf(team);
  if (state === "unlocked") return `Unlocked ${dateOf(team.claimedAt!)}`;
  return state === "ready" ? "Ready to unlock" : "Collect the whole team";
}

function TeamEmojiLine({ album, emoji }: { album: Album; emoji: Emoji }) {
  return (
    <p className="r6t-emoji-line">
      <EmojiArt album={album} emoji={emoji} size={36} />
      <span>
        <code>{emoji.name}</code> is your team emoji. Use it in Slack for reactions and kudos.
      </span>
    </p>
  );
}

function photoSizeOf(people: number) {
  return people >= 6 ? 108 : 128;
}

function PhotoPerson({ person, size, landed }: { person: Person; size: number; landed: boolean }) {
  const collected = isCollected(person);
  return (
    <AppLink href={personHref(person)} className={`r6t-a-person ${collected ? "" : "r6t-a-person-out"} ${landed ? "r6t-landed" : ""}`}>
      <span className="r6t-slot" data-r6-slot={person.key}>
        <Sticker person={person} collected={collected} size={size} />
        {landed && <LandingTouch initials={initialsOf(person.name)} />}
      </span>
      <span className="r6t-a-name">{person.name}</span>
      <span className="r6t-a-role">{collected ? `${person.role ?? "Teammate"}${person.lead ? " · Lead" : ""}` : "Not in your album yet"}</span>
    </AppLink>
  );
}

const sparkleCount = 6;

function LandingTouch({ initials }: { initials: string }) {
  return (
    <span className="r6t-touch" aria-hidden="true">
      <span className="r6t-touch-ghost">
        <Silhouette initials={initials} />
      </span>
      <span className="r6t-touch-ring" />
      {Array.from({ length: sparkleCount }, (_, index) => (
        <span key={index} className="r6t-touch-sparkle" style={{ "--turn": `${(360 / sparkleCount) * index + 15}deg` } as CSSProperties} />
      ))}
    </span>
  );
}

function Caption({ members }: { members: Person[] }) {
  return members.map((person, index) => (
    <Fragment key={person.key}>
      <span className={isCollected(person) ? "" : "r6t-a-caption-out"}>{person.name}</span>
      {index < members.length - 1 ? ", " : ""}
    </Fragment>
  ));
}

export function ClassPhotoPerson({ person: key }: { person: string }) {
  const { album } = useAlbum();
  const person = album.people.find((entry) => entry.key === key);
  if (person === undefined) return <Missing />;
  const collected = isCollected(person);
  const teams = teamsOfPerson(album, person);
  return (
    <article className="r6t r6t-a r6t-a-entry" aria-labelledby="r6t-a-person">
      <BackToTeam team={teams[0]} />
      <div className="r6t-a-entry-body">
        <figure className="r6t-a-mount r6t-a-mount-single">
          <div className="r6t-a-photo">
            <Sticker person={person} collected={collected} size={232} />
          </div>
          <figcaption className="r6t-a-caption">{collected ? `In your album since ${dateOf(person.collectedAt!)}` : "Not in your album yet"}</figcaption>
        </figure>
        <div className="r6t-a-entry-words">
          <p className="r6t-eyebrow">{person.lead ? "Lead" : "Teammate"}</p>
          <h1 id="r6t-a-person" className="r6t-title">
            {person.name}
          </h1>
          <p className="r6t-quiet">{person.role ?? "Teammate"}</p>
          <TeamSeals teams={teams} />
          <PackedThisWeek album={album} person={person} />
          <HypeEmoji album={album} person={person} />
          {collected ? <PersonFacts person={person} /> : <HowTo album={album} person={person} />}
          <BestMessage person={person} />
        </div>
      </div>
    </article>
  );
}

function TeamSeals({ teams }: { teams: Team[] }) {
  return (
    <ul className="r6t-a-seals" aria-label="Teams">
      {teams.map((team) => (
        <li key={team.team}>
          <AppLink href={teamHref(team)} className="r6t-a-seal-link">
            <CrestArt art={team.art} size={36} name={team.name} collected={team.held > 0} />
            <span>
              <strong>{team.name}</strong>
              <span className="r6t-quiet"> {team.held}/{team.total}</span>
            </span>
          </AppLink>
        </li>
      ))}
    </ul>
  );
}
