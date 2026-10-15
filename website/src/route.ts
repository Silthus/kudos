import { useCallback, useEffect, useState } from "react";
import { perkValidator, type PerkId } from "../../convex/progression/tree";
import { crateTargets, signInEntry, type CrateTarget } from "../../convex/website/routes";
import { bookHref, categoryAsked, type CategoryId } from "./book/categories";
import { periods } from "./leaderboard/periods";
import type { Period } from "./shell";

export type QuestTarget = number | "journey";

export type ActivityFilter = "all" | "received" | "given";

export type { CrateTarget };

type Targets = { crate?: CrateTarget };

export type Route =
  | ({ page: "home" } & Targets)
  | { page: "activity"; filter: ActivityFilter }
  | ({ page: "leaderboard"; period: Period } & Targets)
  | ({ page: "quests"; quest?: QuestTarget } & Targets)
  | ({ page: "book"; bookPage: BookPageId } & Targets)
  | ({ page: "skills"; perk?: PerkId } & Targets)
  | { page: "not-found" };

export type BookPageId = CategoryId | "overview" | "earned";

export type Screen = Exclude<Route["page"], "not-found" | "activity">;

const routeAt = {
  "/": (search) => ({ page: "home", crate: crateIn(search) }),
  "/activity": (search) => ({ page: "activity", filter: filterIn(search) }),
  "/leaderboard": (search) => ({ page: "leaderboard", period: periodIn(search), crate: crateIn(search) }),
  "/quests": (search) => ({ page: "quests", quest: questIn(search), crate: crateIn(search) }),
  "/skills": (search) => ({ page: "skills", perk: perkIn(search), crate: crateIn(search) }),
  "/book": (search) => ({ page: "book", bookPage: categoryAsked(search), crate: crateIn(search) }),
  "/book/earned": () => ({ page: "book", bookPage: "earned" }),
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
  return withTargetsOf(route, pageHrefOf(route));
}

function pageHrefOf(route: Route) {
  if (route.page === "leaderboard") return leaderboardHref(route.period);
  if (route.page === "quests") return questsHref(route.quest);
  if (route.page === "book") return bookHref(route.bookPage);
  if (route.page === "activity") return activityHref(route.filter);
  if (route.page === "home" || route.page === "not-found") return "/";
  return `/${route.page}`;
}

function withTargetsOf(route: Route, href: string) {
  const targets = new URLSearchParams();
  if (route.page === "skills" && route.perk !== undefined) targets.set("perk", route.perk);
  if ("crate" in route && route.crate !== undefined) targets.set("crate", route.crate);
  if (targets.size === 0) return href;
  return `${href}${href.includes("?") ? "&" : "?"}${targets}`;
}

export function questsHref(quest?: QuestTarget) {
  return quest === undefined ? "/quests" : `/quests?quest=${quest}`;
}

export function leaderboardHref(period: Period) {
  return period === "week" ? "/leaderboard" : `/leaderboard?period=${period}`;
}

export function activityHref(filter: ActivityFilter) {
  return filter === "all" ? "/activity" : `/activity?filter=${filter}`;
}

const filters: ActivityFilter[] = ["all", "received", "given"];

function filterIn(search: string): ActivityFilter {
  const asked = new URLSearchParams(search).get("filter");
  return filters.find((filter) => filter === asked) ?? "all";
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

const perks: readonly PerkId[] = perkValidator.members.map(({ value }) => value);

function perkIn(search: string): PerkId | undefined {
  const asked = new URLSearchParams(search).get("perk");
  return perks.find((perk) => perk === asked);
}

function crateIn(search: string): CrateTarget | undefined {
  const asked = new URLSearchParams(search).get("crate");
  return crateTargets.find((target) => target === asked);
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
    if (route.page !== "leaderboard" && route.page !== "book" && route.page !== "activity") return;
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

  const chooseFilter = useCallback((filter: ActivityFilter) => {
    window.history.replaceState(null, "", activityHref(filter));
    setRoute(currentRoute());
  }, []);

  return { route, navigate, choosePeriod, chooseFilter };
}
