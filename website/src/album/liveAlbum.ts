import type { AlbumRead as GetAlbumAnswer } from "../../../convex/website/album";
import type { Denial } from "../../../convex/website/memberQuery";
import type { MyAlbum } from "./answer";

export function albumOf(answer: GetAlbumAnswer | Denial): MyAlbum {
  if (answer.kind !== "album") return answer;
  return { teams: [], people: [], emojis: [], milestones: [], gettingStarted: null, ...answer, me: { team: null, ...answer.me } };
}
