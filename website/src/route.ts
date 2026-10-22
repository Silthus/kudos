import { useCallback, useEffect, useState } from "react";
import { perkValidator, type PerkId } from "../../convex/progression/tree";
import { crateParamOf, crateTargetIn, settingsSections, signInEntry, type CrateTarget, type HomePanel, type SettingsSection } from "../../convex/website/routes";
import { bookHref, categoryAsked, type CategoryId } from "./book/categories";
import { spreadIn, type Spread } from "./book/spread/spreads";
import type { BoardPeriod } from "./album/answer";

export type QuestTarget = number | "journey" | "group";

export type ActivityFilter = "all" | "received" | "given";

export type { CrateTarget, HomePanel, SettingsSection };

type Targets = { crate?: CrateTarget };

export type Route =
  | ({ page: "home"; panel?: HomePanel } & Targets)
  | { page: "activity"; filter: ActivityFilter; week?: string }
  | ({ page: "leaderboard"; period: BoardPeriod } & Targets)
  | ({ page: "quests"; quest?: QuestTarget } & Targets)
  | ({ page: "book"; bookPage: BookPageId; spread?: Spread } & Targets)
  | ({ page: "skills"; perk?: PerkId } & Targets)
  | { page: "settings"; section?: SettingsSection }
  | { page: "not-found" };

export type BookPageId = CategoryId | "overview" | "earned" | "collection";

const routeAt = {
  "/": (search) => ({ page: "home", panel: panelIn(search), crate: crateIn(search) }),
  "/activity": (search) => ({ page: "activity", filter: filterIn(search), ...weekIn(search) }),
  "/leaderboard": (search) => ({ page: "leaderboard", period: periodIn(search), crate: crateIn(search) }),
  "/quests": (search) => ({ page: "quests", quest: questIn(search), crate: crateIn(search) }),
  "/skills": (search) => ({ page: "skills", perk: perkIn(search), crate: crateIn(search) }),
  "/book": (search, hash) => ({ page: "book", bookPage: categoryAsked(search), crate: crateIn(search), spread: spreadIn(hash) }),
  "/book/earned": () => ({ page: "book", bookPage: "earned" }),
  "/book/collection": (search, hash) => ({ page: "book", bookPage: "collection", crate: crateIn(search), spread: spreadIn(hash) }),
  "/settings": (search) => ({ page: "settings", section: sectionIn(search) }),
} satisfies Record<string, (search: string, hash: string) => Route>;

type ServedPath = keyof typeof routeAt;

export const servedPaths = Object.keys(routeAt) as ServedPath[];

export function routeOf({ pathname, search, hash }: { pathname: string; search: string; hash: string }): Route {
  const served = servedPaths.find((path) => path === withoutTheSignInEntry(pathname));
  return served === undefined ? { page: "not-found" } : routeAt[served](search, hash);
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
  if (route.page === "activity") return activityHref(route.filter, route.week);
  if (route.page === "home" || route.page === "not-found") return "/";
  return `/${route.page}`;
}

function withTargetsOf(route: Route, href: string) {
  const targets = new URLSearchParams();
  if (route.page === "skills" && route.perk !== undefined) targets.set("perk", route.perk);
  if (route.page === "home" && route.panel !== undefined) targets.set("panel", route.panel);
  if (route.page === "settings" && route.section !== undefined) targets.set("section", route.section);
  const crate = "crate" in route && route.crate !== undefined ? crateParamOf(route.crate) : undefined;
  if (crate !== undefined) targets.set("crate", crate);
  if (targets.size === 0) return href;
  return `${href}${href.includes("?") ? "&" : "?"}${targets}`;
}

export function questsHref(quest?: QuestTarget) {
  return quest === undefined ? "/quests" : `/quests?quest=${quest}`;
}

export function leaderboardHref(period: BoardPeriod) {
  return period === "week" ? "/leaderboard" : `/leaderboard?period=${period}`;
}

export function activityHref(filter: ActivityFilter, week?: string) {
  const asked = new URLSearchParams();
  if (filter !== "all") asked.set("filter", filter);
  if (week !== undefined) asked.set("week", week);
  return asked.size === 0 ? "/activity" : `/activity?${asked}`;
}

const filters: ActivityFilter[] = ["all", "received", "given"];

function filterIn(search: string): ActivityFilter {
  const asked = new URLSearchParams(search).get("filter");
  return filters.find((filter) => filter === asked) ?? "all";
}

const boardPeriods: readonly BoardPeriod[] = ["week", "last-week", "month", "all"];

function periodIn(search: string): BoardPeriod {
  const asked = new URLSearchParams(search).get("period");
  return boardPeriods.find((period) => period === asked) ?? "week";
}

function weekIn(search: string): { week?: string } {
  const asked = new URLSearchParams(search).get("week");
  return asked !== null && startsAWeek(asked) ? { week: asked } : {};
}

function startsAWeek(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day) && date.getUTCDay() === 1;
}

function questIn(search: string): QuestTarget | undefined {
  const asked = new URLSearchParams(search).get("quest");
  if (asked === "journey" || asked === "group") return asked;
  return asked !== null && /^\d+$/.test(asked) ? Number(asked) : undefined;
}

const perks: readonly PerkId[] = perkValidator.members.map(({ value }) => value);

function perkIn(search: string): PerkId | undefined {
  const asked = new URLSearchParams(search).get("perk");
  return perks.find((perk) => perk === asked);
}

function panelIn(search: string): HomePanel | undefined {
  return new URLSearchParams(search).get("panel") === "inventory" ? "inventory" : undefined;
}

function sectionIn(search: string): SettingsSection | undefined {
  const asked = new URLSearchParams(search).get("section");
  return settingsSections.find((section) => section === asked);
}

function crateIn(search: string): CrateTarget | undefined {
  return crateTargetIn(new URLSearchParams(search).get("crate"));
}

function currentRoute() {
  return routeOf(window.location);
}

export function currentAddress() {
  return window.location.pathname + window.location.search + window.location.hash;
}

const keptParams = ["code", "variant", "member"];

export function keepingSignInCode(href: string) {
  const asked = new URLSearchParams(window.location.search);
  const kept = keptParams.filter((name) => asked.has(name));
  if (kept.length === 0) return href;
  const address = new URL(href, window.location.origin);
  kept.forEach((name) => address.searchParams.set(name, asked.get(name)!));
  return address.pathname + address.search + address.hash;
}

function keepingTheHash(href: string) {
  return href + window.location.hash;
}

export function returnAddressOf(route: Route) {
  return keepingTheHash(hrefOf(route));
}

export function useRoute() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    if (route.page !== "leaderboard" && route.page !== "book" && route.page !== "activity") return;
    const canonical = keepingTheHash(keepingSignInCode(hrefOf(route)));
    if (canonical !== currentAddress()) window.history.replaceState(null, "", canonical);
  }, [route]);

  useEffect(() => {
    const follow = () => setRoute(currentRoute());
    window.addEventListener("popstate", follow);
    return () => window.removeEventListener("popstate", follow);
  }, []);

  const navigate = useCallback((href: string, state: unknown = null) => {
    window.history.pushState(state, "", href);
    setRoute(currentRoute());
  }, []);

  const replaceAddress = useCallback((href: string, state: unknown) => {
    window.history.replaceState(state, "", href);
    setRoute(currentRoute());
  }, []);

  return { route, navigate, replaceAddress };
}
