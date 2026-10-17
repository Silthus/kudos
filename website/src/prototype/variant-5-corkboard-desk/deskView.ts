// PROTOTYPE (#625): which desk object is picked up, read from today's route and the address hash.
import { useCallback } from "react";
import { useNavigate } from "../../AppLink";
import type { Route } from "../../route";

export type PickedUp = "quests" | "store" | "achievements" | "activity" | "leaderboard" | "settings" | null;

export type DeskView = { albumOpen: boolean; pickedUp: PickedUp };

export function deskViewOf(route: Route, hash: string): DeskView {
  if (route.page === "book" && route.bookPage === "earned") return { albumOpen: false, pickedUp: "achievements" };
  if (route.page === "book") return { albumOpen: true, pickedUp: hash === "#store" ? "store" : null };
  if (route.page === "quests" || route.page === "activity" || route.page === "leaderboard" || route.page === "settings") return { albumOpen: false, pickedUp: route.page };
  return { albumOpen: false, pickedUp: null };
}

export const hrefOfPickedUp: Record<Exclude<PickedUp, null>, string> = {
  quests: "/quests",
  store: "/book#store",
  achievements: "/book/earned",
  activity: "/activity",
  leaderboard: "/leaderboard",
  settings: "/settings",
};

const trail = { pickedUpFromTheDesk: false };

export function useDeskMoves() {
  const navigate = useNavigate();

  const pickUp = useCallback(
    (object: Exclude<PickedUp, null>) => {
      trail.pickedUpFromTheDesk = true;
      navigate(hrefOfPickedUp[object]);
    },
    [navigate],
  );

  const putDown = useCallback(() => {
    if (trail.pickedUpFromTheDesk) {
      trail.pickedUpFromTheDesk = false;
      window.history.back();
      return;
    }
    navigate("/");
  }, [navigate]);

  return { navigate, pickUp, putDown };
}

export function replacingTheHash(hash: string) {
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#${hash}`);
}
