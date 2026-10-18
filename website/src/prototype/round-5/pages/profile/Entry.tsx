// PROTOTYPE (#625, round 5): the top of your profile, a yearbook entry: your portrait, name, team, level and the last kind note someone left you. Never merge to main.
import { AppLink } from "../../../../AppLink";
import { CrestArt, MemberFace } from "../../../art";
import type { Album, Level, Team } from "../../../round-3/album";
import { whenOf } from "../../../round-3/variant-2-team-yearbook/parts";
import { hrefs, kindNoteOf, myTeamOf, type KindNote } from "./profile";

export function Entry({ album }: { album: Album }) {
  const team = myTeamOf(album);
  const note = kindNoteOf(album);
  return (
    <header className="r5p-entry">
      <Portrait album={album} team={team} />
      <div className="r5p-entry-words">
        <p className="r5p-eyebrow">Your page</p>
        <h1 id="r5p-title" className="r5p-title">
          {album.me.name}
        </h1>
        <TeamChip team={team} />
        <LevelPill level={album.level} />
        {note !== null && <Note note={note} />}
      </div>
    </header>
  );
}

function Portrait({ album, team }: { album: Album; team: Team }) {
  return (
    <figure className="r5p-mount">
      <div className="r5p-photo">
        <span className="r5p-portrait">
          <MemberFace face={album.me.face} className="r5p-portrait-face" />
        </span>
      </div>
      <figcaption className="r5p-caption">
        {album.me.name}, {team.name}
      </figcaption>
    </figure>
  );
}

function TeamChip({ team }: { team: Team }) {
  return (
    <AppLink href={hrefs.myTeam} className="r5p-team-chip">
      <CrestArt art={team.art} size={34} name={team.name} collected={team.complete || team.held > 0} />
      <span>
        <strong>{team.name}</strong>
        <span className="r5p-quiet">
          {" "}
          · {team.held} of {team.total} in your album
        </span>
      </span>
    </AppLink>
  );
}

function LevelPill({ level }: { level: Level }) {
  const words = `${level.toNext} XP to level ${level.level + 1}`;
  return (
    <div className="r5p-level">
      <span className="r5p-level-pill">Level {level.level}</span>
      <div className="r5p-level-way">
        <span role="progressbar" aria-label={words} aria-valuemin={level.startsAt} aria-valuemax={level.nextAt} aria-valuenow={level.xp} className="r5p-bar">
          <span className="r5p-bar-fill" style={{ width: `${Math.max(3, level.progress * 100)}%` }} />
        </span>
        <span className="r5p-level-words">
          <span>{level.xp.toLocaleString("en-GB")} XP</span>
          <span className="r5p-quiet">{words}</span>
        </span>
      </div>
      <p className="r5p-level-note r5p-quiet">Your level grows with every thank-you, hug and pack. It shows how far you have come; nothing to unlock.</p>
    </div>
  );
}

function Note({ note }: { note: KindNote }) {
  return (
    <figure className="r5p-note">
      <p className="r5p-note-label">Someone wrote to you</p>
      <blockquote>“{note.message}”</blockquote>
      <figcaption>
        <AppLink href={hrefs.person(note.person)} className="r5p-note-by">
          <MemberFace face={note.person.face} className="r5p-note-face" />
          <span>
            {note.person.name}, {whenOf(note.at)}
          </span>
        </AppLink>
      </figcaption>
    </figure>
  );
}
