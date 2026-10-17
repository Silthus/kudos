// PROTOTYPE (#625) round 2 variant 4: which docked panels today's route opens, and the real URL of each. Never merge to main.
import { useEffect, useReducer } from "react";
import type { Route } from "../../../route";
import { keepingTheVariant } from "../../variants";

export type BookId = "hoggies" | "teams";

export type CentreId = "store" | "achievements" | "quests" | "activity" | "leaderboard" | "settings";

export type Layout = { book: BookId | null; centre: CentreId | null };

export const centreHref: Record<CentreId, string> = {
  store: "/book#store",
  achievements: "/book/earned",
  quests: "/quests",
  activity: "/activity",
  leaderboard: "/leaderboard",
  settings: "/settings",
};

export const centreName: Record<CentreId, string> = {
  store: "Shop",
  achievements: "Achievements",
  quests: "Quest board",
  activity: "Activity",
  leaderboard: "Leaderboard",
  settings: "Settings",
};

export const bookHref: Record<BookId, string> = { hoggies: "/book#hoggies", teams: "/book#teams" };

const centrePages: Partial<Record<Route["page"], CentreId>> = { quests: "quests", activity: "activity", leaderboard: "leaderboard", settings: "settings" };

export function layoutOf(route: Route, hash: string): Layout {
  if (route.page === "book") {
    if (route.bookPage === "earned") return { book: null, centre: "achievements" };
    if (hash === "#store") return { book: null, centre: "store" };
    return { book: hash.startsWith("#teams") ? "teams" : "hoggies", centre: null };
  }
  return { book: null, centre: centrePages[route.page] ?? null };
}

export function replaceAddress(href: string) {
  window.history.replaceState(window.history.state, "", keepingTheVariant(href));
}

export function replaceHash(hash: string) {
  replaceAddress(`${window.location.pathname}${hash}`);
}

export function useAddressChanges() {
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    window.addEventListener("hashchange", rerender);
    return () => window.removeEventListener("hashchange", rerender);
  }, []);
  return rerender;
}

export function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
