import type { PersonPage } from "./answer";

type Hype = PersonPage["hype"];

export function reactionsWayOf({ earned, reactions }: Hype): string | null {
  return earned || reactions === undefined ? null : `Or react with it on ${reactions.need} of their messages: ${reactions.have} of ${reactions.need}`;
}

export function yourReactionsOf({ earned, byReactions, reactions }: Hype, first: string): string | null {
  return earned && byReactions === true && reactions !== undefined ? `your reactions on ${reactions.need} of ${first}'s messages` : null;
}
