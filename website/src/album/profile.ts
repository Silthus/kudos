import type { Album, AlbumMilestone, AlbumTeam, BoardPerson, BoardTeam, ThoughtfulBoards } from "./answer";
import { metalOrder } from "./milestones";
import { dateOf } from "./teamPage";

type Tier = AlbumMilestone["tiers"][number];

export type BestMedal = { milestone: AlbumMilestone; tier: Tier & { earnedAt: number } };

export type NextMedal = { milestone: AlbumMilestone; tier: Tier };

export type Standing = { me: BoardPerson | null; team: BoardTeam | null; onTheBoards: boolean };

export const bestMedalsShown = 3;

export const rarestShown = 4;

export function peopleGlanceOf(album: Album) {
  return { held: album.people.filter(({ held }) => held).length, total: album.people.length, unlocked: album.teams.filter(({ state }) => state === "unlocked").length, teams: album.teams.length };
}

export function teamFootnoteOf({ state, held, total, unlockedAt }: AlbumTeam) {
  if (state === "unlocked" && unlockedAt !== null) return `Unlocked ${dateOf(unlockedAt)}`;
  if (state === "ready") return "Ready to unlock";
  return `${total - held} to go for the seal`;
}

export function bestMedalsOf(album: Album): BestMedal[] {
  return album.milestones
    .flatMap((milestone) => {
      const tier = highestEarnedOf(milestone);
      return tier === undefined ? [] : [{ milestone, tier }];
    })
    .toSorted((one, other) => metalOrder.indexOf(other.tier.tier) - metalOrder.indexOf(one.tier.tier) || other.tier.earnedAt - one.tier.earnedAt)
    .slice(0, bestMedalsShown);
}

function highestEarnedOf({ tiers }: AlbumMilestone) {
  return tiers.findLast((tier): tier is BestMedal["tier"] => tier.earnedAt !== null);
}

export function closestNextOf(album: Album): NextMedal | null {
  return album.milestones.reduce<NextMedal | null>((closest, milestone) => {
    const tier = milestone.tiers.find(({ earnedAt }) => earnedAt === null);
    if (tier === undefined) return closest;
    const next = { milestone, tier };
    return closest === null || shareOf(next) > shareOf(closest) ? next : closest;
  }, null);
}

export function shareOf({ milestone, tier }: NextMedal) {
  return tier.at <= 0 ? 1 : Math.min(1, milestone.count / tier.at);
}

export function standingOf(boards: ThoughtfulBoards, homeTeam: string | null): Standing {
  const team = boards.pinned.teams.find(({ team: slug }) => slug === homeTeam) ?? boards.pinned.teams[0] ?? null;
  return { me: boards.pinned.me, team, onTheBoards: boards.onTheBoards };
}

export function rankWords({ rank, tied }: { rank: number; tied: boolean }) {
  return `No. ${rank}${tied ? ", tied" : ""}`;
}

export function teamRankWords({ name, rank, tied, thoughtful }: BoardTeam) {
  return rank === null ? `${name} hasn't given one yet this week.` : `${name} is ${rankWords({ rank, tied })} with ${thoughtful}.`;
}
