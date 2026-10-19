import type { AlbumPerson as HeldPerson, AlbumRead as GetAlbumAnswer } from "../../../convex/website/album";
import type { Denial } from "../../../convex/website/memberQuery";
import type { AlbumPerson, MyAlbum } from "./answer";

export function albumOf(answer: GetAlbumAnswer | Denial): MyAlbum {
  if (answer.kind !== "album") return answer;
  const { people, morePeople, ...answered } = answer;
  return { teams: [], emojis: [], milestones: [], gettingStarted: null, ...answered, people: people.map(beforeTheirTeams), me: { team: null, ...answer.me } };
}

function beforeTheirTeams(person: HeldPerson): AlbumPerson {
  return { ...person, teams: [], packedThisWeek: false };
}
