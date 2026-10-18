import type { Route } from "../route";

export type Place =
  | { kind: "team"; team: string | null }
  | { kind: "person"; person: string }
  | { kind: "profile" }
  | { kind: "hoggies"; hoggie: string | null }
  | { kind: "milestones" }
  | { kind: "packs" }
  | { kind: "activity" }
  | { kind: "leaderboard" }
  | { kind: "settings" }
  | { kind: "elsewhere" };

export const home: Place = { kind: "team", team: null };

export function placeOf(route: Route, hash: string): Place {
  switch (route.page) {
    case "home":
      return home;
    case "book":
      return bookPlaceOf(hash);
    case "activity":
    case "leaderboard":
    case "settings":
      return { kind: route.page };
    default:
      return { kind: "elsewhere" };
  }
}

function bookPlaceOf(hash: string): Place {
  const [section, key] = hash.replace(/^#/, "").split("/", 2).map(decoded);
  if (section === "teams" && key) return { kind: "team", team: key };
  if (section === "people" && key) return { kind: "person", person: key };
  if (section === "me") return { kind: "profile" };
  if (section === "hoggies") return { kind: "hoggies", hoggie: key || null };
  if (section === "milestones") return { kind: "milestones" };
  if (section === "packs") return { kind: "packs" };
  return home;
}

function decoded(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function hrefOf(place: Place): string {
  switch (place.kind) {
    case "team":
      return place.team === null ? "/" : `/book#teams/${encodeURIComponent(place.team)}`;
    case "person":
      return `/book#people/${encodeURIComponent(place.person)}`;
    case "profile":
      return "/book#me";
    case "hoggies":
      return place.hoggie === null ? "/book#hoggies" : `/book#hoggies/${encodeURIComponent(place.hoggie)}`;
    case "milestones":
    case "packs":
      return `/book#${place.kind}`;
    case "elsewhere":
      return "/";
    default:
      return `/${place.kind}`;
  }
}

export function keyOf(place: Place): string {
  return hrefOf(place) + (place.kind === "elsewhere" ? "#elsewhere" : "");
}
