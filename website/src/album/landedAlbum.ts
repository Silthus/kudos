import type { Album, AlbumPerson } from "./answer";
import type { Landing } from "./useItemBoard";
import { withTheUnlocked } from "./useTeamUnlock";

export function albumAtTheLanding(album: Album, landing: Landing | null): Album {
  if (landing === null) return album;
  const stickers = landing.unlocked.teamStickers;
  if (landing.phase === "done") return withTheUnlocked(album, stickers);
  const locked = withTheTeamsStillLocked(album, new Set(stickers.map(({ team }) => team)));
  return landing.phase === "arriving" ? withTheStickerStillOut(locked, landing.face) : locked;
}

function withTheTeamsStillLocked(album: Album, teams: ReadonlySet<string>): Album {
  if (teams.size === 0) return album;
  return { ...album, teams: album.teams.map((team) => (teams.has(team.team) ? { ...team, state: "progress", unlockedAt: null } : team)) };
}

function withTheStickerStillOut(album: Album, face: Landing["face"]): Album {
  if (face.kind !== "sticker" || !face.isNew) return album;
  const person = album.people.find((someone) => someone.person === face.person);
  if (person === undefined || !person.held) return album;
  return {
    ...album,
    people: album.people.map((someone) => (someone === person ? notYetPutIn(someone) : someone)),
    teams: album.teams.map((team) => (team.people.includes(face.person) && team.state !== "unlocked" ? { ...team, held: Math.max(0, team.held - 1), state: "progress" } : team)),
  };
}

function notYetPutIn({ at: _putInAt, ...person }: AlbumPerson): AlbumPerson {
  return { ...person, held: false };
}
