import type { Album, AlbumLevel, AlbumTeam, GettingStarted } from "./answer";

export function myTeamOf(album: Album): AlbumTeam | undefined {
  return album.teams.find(({ mine }) => mine);
}

export function teamsByProgress(teams: AlbumTeam[]): AlbumTeam[] {
  return teams.filter(({ mine }) => !mine).toSorted((first, second) => readyFirst(first) - readyFirst(second) || second.held - first.held || first.name.localeCompare(second.name));
}

export function closestToCompleteOf(teams: AlbumTeam[], count: number): AlbumTeam[] {
  return teams
    .filter(({ state, total }) => state !== "unlocked" && total > 0)
    .toSorted((first, second) => readyFirst(first) - readyFirst(second) || leftToCollectOf(first) - leftToCollectOf(second) || progressOf(second) - progressOf(first) || first.name.localeCompare(second.name))
    .slice(0, count);
}

function leftToCollectOf({ held, total }: AlbumTeam) {
  return total - held;
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

export const gettingStartedSteps: { step: keyof GettingStarted; goal: string }[] = [
  { step: "hugged", goal: "Give a hug" },
  { step: "thoughtful", goal: "Give a thoughtful kudos" },
  { step: "opened", goal: "Open a pack" },
  { step: "completed", goal: "Complete a team page" },
];

export function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}
