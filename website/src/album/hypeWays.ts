import { reactionsToCollect } from "../../../convex/album/emojiCatalogue";
import type { PersonPage } from "./answer";

type Hype = PersonPage["hype"];

export function reactionsWayOf({ earned, reactions }: Hype): string | null {
  return earned || reactions === undefined ? null : `Or react with it on ${reactions.need} of their messages: ${reactions.have} of ${reactions.need}`;
}

export function yourReactionsOf({ earned, byReactions }: Hype, first: string): string | null {
  return earned && byReactions === true ? `your reactions on ${reactionsToCollect} of ${first}'s messages` : null;
}
