import type { Album, AlbumLevel, AlbumTeam } from "./answer";

export function myTeamOf(album: Album): AlbumTeam | undefined {
  return album.teams.find(({ mine }) => mine);
}

export function teamsByProgress(teams: AlbumTeam[]): AlbumTeam[] {
  return teams.filter(({ mine }) => !mine).toSorted((first, second) => readyFirst(first) - readyFirst(second) || second.held - first.held || first.name.localeCompare(second.name));
}

function readyFirst({ state }: AlbumTeam) {
  return state === "ready" ? 0 : 1;
}

export function progressOf({ held, total }: AlbumTeam) {
  return total === 0 ? 0 : held / total;
}

export function medalsOf(album: Album) {
  return album.milestones.flatMap(({ tiers }) => tiers).filter(({ earnedAt }) => earnedAt !== null).length;
}

export function earnedEmojisOf(album: Album) {
  return album.emojis.filter(({ earned }) => earned).length;
}

export function xpToNextOf({ xp, nextAt }: AlbumLevel) {
  return Math.max(0, nextAt - xp);
}

export function levelShareOf({ xp, startsAt, nextAt }: AlbumLevel) {
  return nextAt <= startsAt ? 1 : Math.min(1, Math.max(0, (xp - startsAt) / (nextAt - startsAt)));
}

export function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}
