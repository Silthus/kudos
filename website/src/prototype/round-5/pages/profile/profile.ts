// PROTOTYPE (#625, round 5): what your profile reads from the album: your team, your album at a glance, your finds, your best milestones and your rank. Never merge to main.
import type { Album, Hoggie, Milestone, Moment, Person, Team } from "../../../round-3/album";
import { datedMilestones } from "../../../round-4/pages/milestones/dated";
import { bestOf, closestNextOf, tierOrder, type EarnedTier, type NextUp } from "../../../round-4/pages/milestones/model";
import { gapAboveOf, peopleBoardOf, teamBoardOf } from "../../../round-4/pages/leaderboard/board";
import { rarestFinds } from "../../../round-4/pages/hoggies/shelf";
import { hrefOf } from "../../address";

export type Best = { milestone: Milestone; tier: EarnedTier };

export type Glance = { people: { held: number; total: number }; teams: { complete: number; total: number }; hoggies: { found: number; total: number } };

export type Standing = { you: { rank: number; tied: boolean; thoughtful: number; of: number } | null; team: { rank: number; of: number; perPerson: number } | null; gap: { name: string; more: number } | null };

export type KindNote = { person: Person; message: string; at: number };

export function myTeamOf(album: Album): Team {
  return album.teams.find(({ mine }) => mine)!;
}

export function glanceOf(album: Album): Glance {
  return {
    people: { held: album.collected, total: album.people.length },
    teams: { complete: album.teams.filter(({ complete }) => complete).length, total: album.teams.length },
    hoggies: { found: album.hoggiesFound, total: album.hoggies.length },
  };
}

export function coolestHoggiesOf(album: Album): Hoggie[] {
  return rarestFinds(album.hoggies, 4);
}

export function latestPeopleOf(album: Album): Person[] {
  return album.people
    .filter(({ collectedAt }) => collectedAt !== null)
    .toSorted((first, second) => second.collectedAt! - first.collectedAt!)
    .slice(0, 4);
}

export function bestMilestonesOf(album: Album): Best[] {
  return datedMilestones(album)
    .flatMap((milestone) => {
      const tier = bestOf(milestone);
      return tier === null ? [] : [{ milestone, tier }];
    })
    .toSorted((first, second) => tierOrder.indexOf(second.tier.tier) - tierOrder.indexOf(first.tier.tier) || second.tier.earnedAt - first.tier.earnedAt)
    .slice(0, 3);
}

export function closestNextMilestoneOf(album: Album): NextUp | null {
  return closestNextOf(datedMilestones(album));
}

export function standingOf(album: Album): Standing {
  const people = peopleBoardOf(album, "week");
  const teams = teamBoardOf(album, "week");
  const you = people.find((row) => row.you);
  const team = teams.find(({ mine }) => mine);
  const gap = gapAboveOf(people);
  return {
    you: you === undefined ? null : { rank: you.rank, tied: you.tied, thoughtful: you.thoughtful, of: people.length },
    team: team === undefined ? null : { rank: team.rank, of: teams.length, perPerson: team.perPerson },
    gap: gap === undefined ? null : { name: gap.name, more: gap.more },
  };
}

export function kindNoteOf(album: Album): KindNote | null {
  const moment = album.moments.find((entry): entry is Extract<Moment, { kind: "thoughtful-received" }> => entry.kind === "thoughtful-received");
  const person = moment === undefined ? undefined : album.people.find(({ key }) => key === moment.person);
  return moment === undefined || person === undefined ? null : { person, message: moment.message, at: moment.at };
}

export function shareOf(part: number, whole: number) {
  return whole === 0 ? 0 : Math.min(1, part / whole);
}

export function ordinalRank(rank: number) {
  return `No. ${rank}`;
}

export const hrefs = {
  myTeam: hrefOf({ kind: "team", team: null }),
  milestones: hrefOf({ kind: "milestones" }),
  hoggies: hrefOf({ kind: "hoggies" }),
  leaderboard: hrefOf({ kind: "leaderboard" }),
  person: (person: Person) => hrefOf({ kind: "person", key: person.key }),
  hoggie: (hoggie: Hoggie) => `${hrefOf({ kind: "hoggies" })}/${encodeURIComponent(hoggie.hoggie)}`,
};
