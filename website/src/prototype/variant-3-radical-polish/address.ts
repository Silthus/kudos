// PROTOTYPE (#625): where the Radical polish variant is, read straight from the address bar. Never merge to main.
import { createContext, useContext } from "react";
import type { Rarity } from "../../shell";
import { keepingTheVariant } from "../variants";
import { rarityOrder } from "../world";

export type Chapter = { kind: "hoggies"; rarity: Rarity } | { kind: "teams"; team: string } | { kind: "store" } | { kind: "earned" };

export type BookAddress = { chapter: Chapter; page: number };

export type Section = "home" | "collection" | "teams" | "quests" | "store" | "earned" | "activity" | "leaderboard" | "settings" | "elsewhere";

export function bookAddressHere(firstTeam: string): BookAddress {
  const page = (raw: string | undefined) => Math.max(1, Number(raw) || 1);
  if (window.location.pathname === "/book/earned") return { chapter: { kind: "earned" }, page: page(window.location.hash.slice(1)) };
  const [kind, which, pageAsked] = window.location.hash.slice(1).split("/");
  if (kind === "store") return { chapter: { kind: "store" }, page: page(which) };
  if (kind === "teams") return { chapter: { kind: "teams", team: which || firstTeam }, page: page(pageAsked) };
  const rarity = rarityOrder.find((entry) => entry === which) ?? "common";
  return { chapter: { kind: "hoggies", rarity }, page: page(pageAsked) };
}

export function hrefOfChapter(chapter: Chapter, page = 1) {
  const suffix = page > 1 ? `/${page}` : "";
  if (chapter.kind === "earned") return page > 1 ? `/book/earned#${page}` : "/book/earned";
  if (chapter.kind === "store") return `/book#store${suffix}`;
  if (chapter.kind === "teams") return `/book#teams/${chapter.team}${suffix}`;
  return `/book#hoggies/${chapter.rarity}${suffix}`;
}

export function sectionHere(): Section {
  const { pathname, hash } = window.location;
  if (pathname === "/") return "home";
  if (pathname === "/book/earned") return "earned";
  if (pathname === "/book" || pathname === "/book/collection") {
    if (hash.startsWith("#teams")) return "teams";
    if (hash.startsWith("#store")) return "store";
    return "collection";
  }
  const named = ["quests", "activity", "leaderboard", "settings"] as const;
  return named.find((name) => pathname === `/${name}`) ?? "elsewhere";
}

export function pageGroupOf(pathname: string) {
  return pathname.startsWith("/book") ? "/book" : pathname;
}

export type Relocate = (href: string, how: "push" | "replace") => void;

export const RelocateContext = createContext<Relocate>(() => undefined);

export function useRelocate() {
  return useContext(RelocateContext);
}

export function relocateWith(rerender: () => void): Relocate {
  return (href, how) => {
    const address = keepingTheVariant(href);
    const here = window.location.pathname + window.location.search + window.location.hash;
    if (how === "push" && address !== here) window.history.pushState(null, "", address);
    else window.history.replaceState(null, "", address);
    rerender();
  };
}
