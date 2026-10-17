// PROTOTYPE (#625): Meadow realm addresses: which docked windows a URL opens, and HUD history that closes them cleanly. Never merge to main.
import { useCallback, useEffect, useReducer } from "react";
import { useNavigate } from "../../../AppLink";
import type { Route } from "../../../route";
import { keepingTheVariant } from "../../variants";

export type LeftId = "hoggies" | "teams" | "quests" | "activity" | "leaderboard";

export type CentreId = "store" | "achievements" | "settings";

export type Docked = { left: LeftId | null; centre: CentreId | null };

export function dockedAt(route: Route, hash: string): Docked {
  if (route.page === "book" && route.bookPage === "earned") return { left: null, centre: "achievements" };
  if (route.page === "book" && hash.startsWith("#store")) return { left: null, centre: "store" };
  if (route.page === "book") return { left: hash.startsWith("#teams") ? "teams" : "hoggies", centre: null };
  if (route.page === "quests" || route.page === "activity" || route.page === "leaderboard") return { left: route.page, centre: null };
  if (route.page === "settings") return { left: null, centre: "settings" };
  return { left: null, centre: null };
}

export const hrefOf: Record<LeftId | CentreId, string> = {
  hoggies: "/book#hoggies",
  teams: "/book#teams",
  quests: "/quests",
  activity: "/activity",
  leaderboard: "/leaderboard",
  store: "/book#store",
  achievements: "/book/earned",
  settings: "/settings",
};

export function replaceAddress(href: string) {
  window.history.replaceState(window.history.state, "", keepingTheVariant(href));
}

type HudState = { mrDepth: number; mrOver: LeftId | null };

function hudState(): HudState | null {
  const state: unknown = window.history.state;
  if (typeof state !== "object" || state === null || !("mrDepth" in state)) return null;
  return state as HudState;
}

export function openedOver() {
  return hudState()?.mrOver ?? null;
}

export function useHudNavigation() {
  const navigate = useNavigate();
  const open = useCallback(
    (href: string, over: LeftId | null) => {
      const depth = (hudState()?.mrDepth ?? 0) + 1;
      navigate(href);
      window.history.replaceState({ mrDepth: depth, mrOver: over } satisfies HudState, "");
    },
    [navigate],
  );
  const home = useCallback(() => {
    const depth = hudState()?.mrDepth ?? 0;
    if (depth > 0) window.history.go(-depth);
    else navigate("/");
  }, [navigate]);
  const back = useCallback(() => window.history.back(), []);
  return { open, home, back, navigate };
}

export function useRerender() {
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
