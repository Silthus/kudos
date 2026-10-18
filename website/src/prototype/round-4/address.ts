// PROTOTYPE (#625, round 4): which place of the album the route and hash name, and the href of each place. Never merge to main.
import { useEffect, useReducer } from "react";
import type { Route } from "../../route";

export type Place =
  | { kind: "team"; team: string | null }
  | { kind: "person"; key: string }
  | { kind: "hoggies" }
  | { kind: "milestones" }
  | { kind: "activity" }
  | { kind: "leaderboard" }
  | { kind: "settings" }
  | { kind: "not-found" };

export function placeOf(route: Route, hash: string): Place {
  if (route.page === "activity" || route.page === "leaderboard" || route.page === "settings" || route.page === "not-found") return { kind: route.page };
  if (route.page === "book" && route.bookPage === "earned") return { kind: "milestones" };
  const [section = "", ...rest] = decodeURIComponent(hash.replace(/^#/, "")).split("/");
  const page = rest.join("/");
  if (section === "people" && page !== "") return { kind: "person", key: page };
  if (section === "hoggies") return { kind: "hoggies" };
  if (section === "teams" && page !== "") return { kind: "team", team: page };
  return { kind: "team", team: null };
}

export function hrefOf(place: Place) {
  if (place.kind === "team") return place.team === null ? "/" : `/book#teams/${place.team}`;
  if (place.kind === "person") return `/book#people/${place.key}`;
  if (place.kind === "hoggies") return "/book#hoggies";
  if (place.kind === "milestones") return "/book/earned";
  if (place.kind === "not-found") return "/";
  return `/${place.kind}`;
}

export const packsHash = "#packs";

export function useHash() {
  const [, rerender] = useReducer((seen: number) => seen + 1, 0);
  useEffect(() => {
    window.addEventListener("hashchange", rerender);
    window.addEventListener("popstate", rerender);
    return () => {
      window.removeEventListener("hashchange", rerender);
      window.removeEventListener("popstate", rerender);
    };
  }, []);
  return window.location.hash;
}
