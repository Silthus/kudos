// PROTOTYPE (#625, round 5): round 4's places plus your profile at /book#me. Never merge to main.
import type { Route } from "../../route";
import { hrefOf as hrefOfRoundFour, packsHash, placeOf as placeOfRoundFour, useHash, type Place as RoundFourPlace } from "../round-4/address";

export type Place = RoundFourPlace | { kind: "profile" };

export { packsHash, useHash };

export const profileHash = "#me";

export function placeOf(route: Route, hash: string): Place {
  return route.page === "book" && hash === profileHash ? { kind: "profile" } : placeOfRoundFour(route, hash);
}

export function hrefOf(place: Place) {
  return place.kind === "profile" ? `/book${profileHash}` : hrefOfRoundFour(place);
}
