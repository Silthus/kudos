import { useCallback, useEffect, useState } from "react";
import { signInEntry } from "../../convex/website/routes";
import { bookHref, categoryAsked, type CategoryId } from "./book/categories";
import { periods } from "./leaderboard/periods";
import type { Period } from "./shell";

export type QuestTarget = number | "journey";

export type Route = { page: "home" } | { page: "leaderboard"; period: Period } | { page: "quests"; quest?: QuestTarget } | { page: "book"; bookPage: BookPageId } | { page: "skills" } | { page: "not-found" };

export type BookPageId = CategoryId | "overview";

export type Screen = Exclude<Route["page"], "not-found">;

const routeAt = {
  "/": () => ({ page: "home" }),
  "/leaderboard": (search) => ({ page: "leaderboard", period: periodIn(search) }),
  "/quests": (search) => ({ page: "quests", quest: questIn(search) }),
  "/skills": () => ({ page: "skills" }),
  "/book": (search) => ({ page: "book", bookPage: categoryAsked(search) }),
} satisfies Record<string, (search: string) => Route>;

type ServedPath = keyof typeof routeAt;

export const servedPaths = Object.keys(routeAt) as ServedPath[];

export function routeOf({ pathname, search }: { pathname: string; search: string }): Route {
  const served = servedPaths.find((path) => path === withoutTheSignInEntry(pathname));
  return served === undefined ? { page: "not-found" } : routeAt[served](search);
}

export function withoutTheSignInEntry(pathname: string) {
  if (pathname !== signInEntry && !pathname.startsWith(`${signInEntry}/`)) return pathname;
  return `/${pathname.slice(signInEntry.length).replace(/^\/+/, "")}`;
}

export function hrefOf(route: Route) {
  if (route.page === "leaderboard") return leaderboardHref(route.period);
  if (route.page === "quests") return questsHref(route.quest);
  if (route.page === "book") return bookHref(route.bookPage);
  if (route.page === "home" || route.page === "not-found") return "/";
  return `/${route.page}`;
}

export function questsHref(quest?: QuestTarget) {
  return quest === undefined ? "/quests" : `/quests?quest=${quest}`;
}

export function leaderboardHref(period: Period) {
  return period === "week" ? "/leaderboard" : `/leaderboard?period=${period}`;
}

function periodIn(search: string): Period {
  const asked = new URLSearchParams(search).get("period");
  return periods.find(({ period }) => period === asked)?.period ?? "week";
}

function questIn(search: string): QuestTarget | undefined {
  const asked = new URLSearchParams(search).get("quest");
  if (asked === "journey") return asked;
  return asked !== null && /^\d+$/.test(asked) ? Number(asked) : undefined;
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
    if (route.page !== "leaderboard" && route.page !== "book") return;
    const canonical = keepingSignInCode(hrefOf(route));
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
