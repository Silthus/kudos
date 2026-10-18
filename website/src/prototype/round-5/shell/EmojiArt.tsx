// PROTOTYPE (#625, round 6): the one way an emoji is drawn, everywhere: a Slack-sized tile with a team crest, a face with a spark, a milestone's gold emblem or a level star. Never merge to main.
import type { CSSProperties } from "react";
import type { Face } from "../../../shell";
import { AchievementEmblem, CrestArt, MemberFace } from "../../art";
import { personOf, type Album, type Emoji } from "../../round-3/album";
import "./emoji.css";

export function EmojiArt({ album, emoji, size }: { album: Album; emoji: Emoji; size: number }) {
  return (
    <span className="r6s-art" data-kind={emoji.source.kind} data-locked={emoji.unlocked ? undefined : ""} style={{ width: size, height: size, fontSize: Math.round(size * 0.34) } as CSSProperties} aria-hidden="true">
      <ArtOf album={album} emoji={emoji} size={size} />
    </span>
  );
}

function ArtOf({ album, emoji, size }: { album: Album; emoji: Emoji; size: number }) {
  const { source } = emoji;
  if (source.kind === "team") {
    const team = album.teams.find((entry) => entry.team === source.team);
    return team === undefined ? null : <CrestArt art={team.art} size={Math.round(size * 0.9)} name={team.name} collected={emoji.unlocked} />;
  }
  if (source.kind === "milestone") return <AchievementEmblem ladder={source.emblem} best={emoji.unlocked ? "gold" : null} size={size} />;
  if (source.kind === "level") return <LevelStar level={source.level} />;
  const person = personOf(album, source.person);
  return person === undefined ? null : <HypeFace face={person.face} />;
}

function HypeFace({ face }: { face: Face }) {
  return (
    <>
      <MemberFace face={face} className="r6s-art-face" />
      <Spark />
    </>
  );
}

function LevelStar({ level }: { level: number }) {
  return (
    <span className="r6s-art-level">
      <span>{level}</span>
    </span>
  );
}

export function Spark() {
  return (
    <svg viewBox="0 0 24 24" className="r6s-art-spark">
      <path d="M12 1.5 14.6 8.4 21.8 9.1 16.3 13.8 18 21 12 17.1 6 21 7.7 13.8 2.2 9.1 9.4 8.4Z" />
    </svg>
  );
}
