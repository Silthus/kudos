import type { AlbumPerson as HeldPerson, AlbumRead as GetAlbumAnswer } from "../../../convex/website/album";
import type { Denial } from "../../../convex/website/memberQuery";
import type { AlbumPerson, AlbumTeam, MyAlbum } from "./answer";

export function albumOf(answer: GetAlbumAnswer | Denial): MyAlbum {
  if (answer.kind !== "album") return answer;
  const { people, morePeople, milestones = [], ...answered } = answer;
  return { emojis: [], gettingStarted: null, ...answered, milestones, people: people.map((person) => onTheirTeams(person, answer.teams)), me: { team: null, ...answer.me } };
}

function onTheirTeams(person: HeldPerson, teams: AlbumTeam[]): AlbumPerson {
  return { ...person, teams: teams.filter(({ people }) => people.includes(person.person)).map(({ team }) => team), packedThisWeek: false };
}
