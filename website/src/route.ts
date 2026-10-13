import { useCallback, useEffect, useState } from "react";
import type { Period } from "./shell";

export type Route = { page: "home" } | { page: "leaderboard"; period: Period } | { page: "not-found" };

export type Screen = Exclude<Route["page"], "not-found">;

const periods: readonly Period[] = ["week", "month", "all"];

export function routeOf({ pathname, search }: { pathname: string; search: string }): Route {
  if (pathname === "/") return { page: "home" };
  if (pathname === "/leaderboard") return { page: "leaderboard", period: periodIn(search) };
  return { page: "not-found" };
}

export function leaderboardHref(period: Period) {
  return period === "week" ? "/leaderboard" : `/leaderboard?period=${period}`;
}

function periodIn(search: string): Period {
  const asked = new URLSearchParams(search).get("period");
  return periods.find((period) => period === asked) ?? "week";
}

function currentRoute() {
  return routeOf(window.location);
}

export function useRoute() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    if (route.page !== "leaderboard") return;
    const canonical = leaderboardHref(route.period);
    if (canonical !== window.location.pathname + window.location.search) window.history.replaceState(null, "", canonical);
  }, [route]);

  useEffect(() => {
    const follow = () => setRoute(currentRoute());
    window.addEventListener("popstate", follow);
    return () => window.removeEventListener("popstate", follow);
  }, []);

  const navigate = useCallback((href: string) => {
    window.history.pushState(null, "", href);
    setRoute(currentRoute());
  }, []);

  const choosePeriod = useCallback((period: Period) => {
    window.history.replaceState(null, "", leaderboardHref(period));
    setRoute(currentRoute());
  }, []);

  return { route, navigate, choosePeriod };
}
