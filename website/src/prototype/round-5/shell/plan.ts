// PROTOTYPE (#625, round 5): where each opened card goes and in which order "Put them all in" visits the team pages. Never merge to main.
import { personOf, type Album, type PackOpening, type Team } from "../../round-3/album";
import { hrefOf } from "../address";

export type Visit = { team: Team; openings: PackOpening[]; completes: boolean };

export type Plan = { hoggiesOnly: PackOpening[]; visits: Visit[] };

export function bringsANewFace(album: Album, opening: PackOpening) {
  return personOf(album, opening.person.key)?.collectedAt === null;
}

function missingFrom(album: Album, team: Team) {
  return team.people.filter((key) => personOf(album, key)?.collectedAt === null);
}

export function completedBy(album: Album, team: Team, arriving: ReadonlySet<string>) {
  const missing = missingFrom(album, team);
  return missing.length > 0 && missing.every((key) => arriving.has(key));
}

export function destinationOf(album: Album, opening: PackOpening, arriving: ReadonlySet<string>): Team {
  const teams = album.teams.filter(({ team }) => opening.person.teams.includes(team));
  return teams.find((team) => completedBy(album, team, arriving)) ?? teams.find(({ mine }) => mine) ?? teams[0]!;
}

export function teamPageHref(team: Team) {
  return hrefOf({ kind: "team", team: team.mine ? null : team.team });
}

export function planOf(album: Album, openings: PackOpening[], currentTeam: string | null): Plan {
  const newFaces = openings.filter((opening) => bringsANewFace(album, opening));
  const arriving = new Set(newFaces.map(({ person }) => person.key));
  const byTeam = new Map<string, Visit>();
  for (const opening of newFaces) {
    const team = destinationOf(album, opening, arriving);
    const visit = byTeam.get(team.team) ?? { team, openings: [], completes: completedBy(album, team, arriving) };
    visit.openings.push(opening);
    byTeam.set(team.team, visit);
  }
  const orderOf = (visit: Visit) => (visit.completes ? 2 : visit.team.team === currentTeam ? 0 : 1);
  return { hoggiesOnly: openings.filter((opening) => !bringsANewFace(album, opening)), visits: [...byTeam.values()].toSorted((first, second) => orderOf(first) - orderOf(second)) };
}
