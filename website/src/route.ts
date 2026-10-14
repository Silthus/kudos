import { useCallback, useEffect, useState } from "react";
import { periods } from "./leaderboard/periods";
import type { Period } from "./shell";

export type Route = { page: "home" } | { page: "leaderboard"; period: Period } | { page: "not-found" };

export type Screen = Exclude<Route["page"], "not-found">;

const routeAt = {
  "/": () => ({ page: "home" }),
  "/leaderboard": (search) => ({ page: "leaderboard", period: periodIn(search) }),
} satisfies Record<string, (search: string) => Route>;

type ServedPath = keyof typeof routeAt;

export const servedPaths = Object.keys(routeAt) as ServedPath[];

export function routeOf({ pathname, search }: { pathname: string; search: string }): Route {
  const served = servedPaths.find((path) => path === pathname);
  return served === undefined ? { page: "not-found" } : routeAt[served](search);
}

export function hrefOf(route: Route) {
  return route.page === "leaderboard" ? leaderboardHref(route.period) : "/";
}

export function leaderboardHref(period: Period) {
  return period === "week" ? "/leaderboard" : `/leaderboard?period=${period}`;
}

function periodIn(search: string): Period {
  const asked = new URLSearchParams(search).get("period");
  return periods.find(({ period }) => period === asked)?.period ?? "week";
}

function currentRoute() {
  return routeOf(window.location);
}

function currentAddress() {
  return window.location.pathname + window.location.search;
}

function keepingSignInCode(href: string) {
  const code = new URLSearchParams(window.location.search).get("code");
  if (code === null) return href;
  const address = new URL(href, window.location.origin);
  address.searchParams.set("code", code);
  return address.pathname + address.search;
}

export function useRoute() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    if (route.page !== "leaderboard") return;
    const canonical = keepingSignInCode(leaderboardHref(route.period));
    if (canonical !== currentAddress()) window.history.replaceState(null, "", canonical);
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
