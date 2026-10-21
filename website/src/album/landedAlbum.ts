import type { ReachedTier } from "../../../convex/album/milestones";
import type { Album, AlbumEmoji, AlbumPerson } from "./answer";
import { medalKeyOf } from "./milestones";
import type { Landing } from "./useItemBoard";
import { withTheUnlocked } from "./useTeamUnlock";

export function albumAtTheLanding(album: Album, landing: Landing | null): Album {
  if (landing === null) return album;
  const medalsStillHeld = landing.unlocked.milestones.slice(landing.medalsShown);
  return withTheEmojisStillHeld(withTheMedalsStillHeld(albumAtTheStickers(album, landing), medalsStillHeld), emojisStillHeldAt(landing, medalsStillHeld));
}

function emojisStillHeldAt(landing: Landing, medalsStillHeld: ReachedTier[]): (emoji: AlbumEmoji) => boolean {
  const teams = new Set(landing.unlocked.teamStickers.slice(landing.teamsShown).map(({ team }) => `team:${team}`));
  const medals = new Set(medalsStillHeld.map((tier) => `milestone:${medalKeyOf(tier)}`));
  const hype = landing.phase === "arriving" ? landing.unlocked.hype?.name : undefined;
  return ({ id, kind, name }) => teams.has(id) || medals.has(id) || (kind === "hype" && name === hype);
}

function withTheEmojisStillHeld(album: Album, stillHeld: (emoji: AlbumEmoji) => boolean): Album {
  if (!album.emojis.some(stillHeld)) return album;
  return { ...album, emojis: album.emojis.map((emoji) => (stillHeld(emoji) ? { ...emoji, earned: false, earnedAt: null } : emoji)) };
}

function albumAtTheStickers(album: Album, landing: Landing): Album {
  const stickers = landing.unlocked.teamStickers;
  const shown = withTheUnlocked(album, stickers.slice(0, landing.teamsShown));
  const locked = withTheTeamsStillLocked(shown, new Set(stickers.slice(landing.teamsShown).map(({ team }) => team)));
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

function withTheMedalsStillHeld(album: Album, tiers: ReachedTier[]): Album {
  if (tiers.length === 0) return album;
  const held = new Set(tiers.map(medalKeyOf));
  return { ...album, milestones: album.milestones.map((milestone) => ({ ...milestone, tiers: milestone.tiers.map((step) => (held.has(medalKeyOf({ milestone: milestone.id, tier: step.tier })) ? { ...step, earnedAt: null } : step)) })) };
}
