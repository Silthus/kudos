// PROTOTYPE hash router and app state. No persistence beyond the theme and shell choice.
import { createContext, useContext, useEffect, useState } from "react";

export type ScreenId = "profile" | "quests" | "skills" | "stickers" | "achievements" | "collection" | "leaderboard" | "landing";

export type Route = { screen: ScreenId; param?: string } | { screen: "signin"; next?: string };

export function parseHash(hash: string): Route {
  const [path, query] = hash.replace(/^#\/?/, "").split("?");
  const [screen, param] = path.split("/");
  if (screen === "signin") return { screen: "signin", next: new URLSearchParams(query).get("next") ?? undefined };
  const known: ScreenId[] = ["profile", "quests", "skills", "stickers", "achievements", "collection", "leaderboard", "landing"];
  return known.includes(screen as ScreenId) ? { screen: screen as ScreenId, param } : { screen: "profile" };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function go(screen: ScreenId | "signin", param?: string) {
  location.hash = `/${screen}${param ? `/${param}` : ""}`;
}

export type Nav = { go: typeof go; signedIn: boolean; setSignedIn: (v: boolean) => void };

export const NavContext = createContext<Nav>({ go, signedIn: true, setSignedIn: () => {} });
export const useNav = () => useContext(NavContext);
