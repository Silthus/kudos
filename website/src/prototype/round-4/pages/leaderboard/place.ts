// PROTOTYPE (#625, round 4): the board's period and view, read from and written to the address (?period= and #teams). Never merge to main.
import { periods, type Period } from "./board";

export type View = "people" | "teams";

export type BoardPlace = { period: Period; view: View };

const teamsHash = "#teams";

export function boardPlaceNow(): BoardPlace {
  const asked = new URLSearchParams(window.location.search).get("period");
  const period = periods.find((each) => each.period === asked)?.period ?? "week";
  return { period, view: window.location.hash === teamsHash ? "teams" : "people" };
}

export function boardHref({ period, view }: BoardPlace) {
  const search = period === "week" ? "" : `?period=${period}`;
  return `/leaderboard${search}${view === "teams" ? teamsHash : ""}`;
}
