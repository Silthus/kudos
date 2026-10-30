import { useId, type ReactNode } from "react";
import { SlackLink } from "../SlackLink";
import type { Album, AlbumPerson, AlbumTeam, BookNext } from "./answer";
import { plural } from "./facts";
import { FloatingCard } from "./FloatingCard";
import { kudosOnlyOddsWords } from "./milestones";
import { PersonPicture } from "./PersonPicture";
import { SealArt, sealSize } from "./Seal";
import { TeamEmojiPicture } from "./TeamEmojiPicture";
import { firstNameOf, missingFrom, oneMoreKudosWords, teamEmojiNameOf, teamEmojiOf, teamHoggiePaidWords, waitingStickerLabels, waitingStickerOf, waitingStickerWords, type WaitingSticker } from "./teamPage";
import { useFloatingCard, type FloatingCardState } from "./useFloatingCard";
import "./lockedTeam.css";

type Locked = { album: Album; team: AlbumTeam; bookNext: BookNext };

export function TeamProgressBar({ album, team, bookNext }: Locked) {
  const card = useFloatingCard<HTMLDivElement>();
  const words = useId();
  return (
    <div ref={card.spot} className="al-team-progress">
      <button type="button" className="al-team-progress-open" aria-expanded={card.open} aria-describedby={words} onClick={card.toggle}>
        Unlock the {team.name} sticker
      </button>
      <span id={words} className="al-team-progress-words">
        {team.held} of {team.total} collected · {team.total - team.held} to go
      </span>
      <span className="al-team-progress-track" role="progressbar" aria-label={`${team.held} of ${team.total} collected`} aria-valuenow={team.held} aria-valuemin={0} aria-valuemax={team.total}>
        <span className="al-team-progress-fill" style={{ width: `${(team.held / team.total) * 100}%` }} />
      </span>
      {card.open && <TeamCard state={card} album={album} team={team} bookNext={bookNext} focus={null} />}
    </div>
  );
}

export function LockedSeal({ album, team, bookNext }: Locked) {
  const card = useFloatingCard<HTMLDivElement>();
  return (
    <div ref={card.spot} className="al-seal-spot">
      <button type="button" className="al-seal" data-state="progress" data-al-seal={team.team} aria-label={`${team.name} sticker, ${team.held} of ${team.total}: how to unlock it`} aria-expanded={card.open} onClick={card.toggle}>
        <SealArt team={team} coloured={false} size={sealSize} />
        <span className="al-seal-mark" aria-hidden="true">
          ?
        </span>
      </button>
      {card.open && <TeamCard state={card} album={album} team={team} bookNext={bookNext} focus={null} />}
    </div>
  );
}

export function MissingTeammate({ album, team, bookNext, person, children }: Locked & { person: AlbumPerson; children: ReactNode }) {
  const card = useFloatingCard<HTMLLIElement>();
  return (
    <li ref={card.spot} className="al-photo-person" data-out="">
      <button type="button" className="al-photo-link al-photo-missing" aria-label={`${person.name}, not in your album yet: how to get them`} aria-expanded={card.open} onClick={card.toggle}>
        <PersonPicture face={person.face} name={person.name} collected={false} frame="al-photo-sticker" className="al-photo-face" />
        <span className="al-photo-name ph-no-capture">{person.name}</span>
        <span className="al-photo-hint">How to get</span>
      </button>
      {children}
      {card.open && <TeamCard state={card} album={album} team={team} bookNext={bookNext} focus={person} />}
    </li>
  );
}

function TeamCard({ state, album, team, bookNext, focus }: Locked & { state: FloatingCardState; focus: AlbumPerson | null }) {
  const title = focus === null ? `Unlock the ${team.name} sticker` : `${firstNameOf(focus.name)} isn't in your album yet`;
  return (
    <FloatingCard state={state} label={title}>
      <h4 className="al-floating-title">{title}</h4>
      <p className="al-floating-label">How to get it</p>
      {focus === null ? <HowToCompleteTheTeam album={album} team={team} chatUrl={bookNext.chatUrl} /> : <HowToGetTeammate album={album} team={team} person={focus} chatUrl={bookNext.chatUrl} />}
      <p className="al-floating-label">What the sticker pays</p>
      <ul className="al-floating-pays" aria-label="What the sticker pays">
        <li>{teamHoggiePaidWords(bookNext.rarityCaps)}</li>
        <li className="ph-no-capture">
          <TeamEmojiPicture art={team.art} name={team.name} emoji={teamEmojiOf(album, team.team)} size={16} />:{teamEmojiNameOf(album, team.team)}:
        </li>
      </ul>
      {bookNext.rarityCaps && <p className="al-floating-note">{kudosOnlyOddsWords}</p>}
    </FloatingCard>
  );
}

function HowToCompleteTheTeam({ album, team, chatUrl }: { album: Album; team: AlbumTeam; chatUrl: string }) {
  const left = missingFrom(album, team);
  return (
    <>
      <p>Give a kudos to every member. {plural(left.length, "person", "people")} left:</p>
      <ul className="al-give">
        {left.map((person) => (
          <GiveRow key={person.person} person={person} waiting={waitingStickerOf(album, person.person)} chatUrl={chatUrl} />
        ))}
      </ul>
    </>
  );
}

function HowToGetTeammate({ album, team, person, chatUrl }: { album: Album; team: AlbumTeam; person: AlbumPerson; chatUrl: string }) {
  const waiting = waitingStickerOf(album, person.person);
  if (waiting !== null) return <p>{waitingStickerWords(waiting, person.name)}</p>;
  return (
    <>
      <p>{oneMoreKudosWords(team, person.name)}</p>
      <ul className="al-give">
        <GiveRow person={person} waiting={null} chatUrl={chatUrl} />
      </ul>
    </>
  );
}

function GiveRow({ person, waiting, chatUrl }: { person: AlbumPerson; waiting: WaitingSticker | null; chatUrl: string }) {
  return (
    <li className="al-give-row">
      <PersonPicture face={person.face} name={person.name} collected={false} frame="al-give-face" className="al-photo-face" />
      <span className="al-give-name ph-no-capture">{person.name}</span>
      {waiting === null ? (
        <SlackLink chatUrl={chatUrl} variant="outline">
          Give {firstNameOf(person.name)} a kudos
        </SlackLink>
      ) : (
        <span className="al-give-waiting">{waitingStickerLabels[waiting]}</span>
      )}
    </li>
  );
}
