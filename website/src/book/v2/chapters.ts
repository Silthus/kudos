import { useSyncExternalStore } from "react";
import type { Rarity } from "../../crates/drops";
import { categories, type CategoryId } from "../categories";

export type Chapter = { kind: "cover" } | { kind: "hoggies"; rarity: Rarity } | { kind: "teams" } | { kind: "team"; team: string } | { kind: "achievements"; category: CategoryId | "all" };

export type Section = "cover" | "hoggies" | "teams" | "achievements";

const rarities: Rarity[] = ["legendary", "epic", "rare", "uncommon", "common"];

const cover: Chapter = { kind: "cover" };

export function chapterOf(hash: string, fallback: Chapter = cover): Chapter {
  const [head, tail] = hash.replace(/^#/, "").split("/");
  if (head === "hoggies") return { kind: "hoggies", rarity: rarities.find((rarity) => rarity === tail) ?? "legendary" };
  if (head === "teams") return tail ? { kind: "team", team: tail } : { kind: "teams" };
  if (head === "achievements") return { kind: "achievements", category: categories.find(({ id }) => id === tail)?.id ?? "all" };
  if (head === "cover") return cover;
  return fallback;
}

export function chapterHref(chapter: Chapter) {
  if (chapter.kind === "cover") return "/book#cover";
  if (chapter.kind === "hoggies") return `/book#hoggies/${chapter.rarity}`;
  if (chapter.kind === "teams") return "/book#teams";
  if (chapter.kind === "team") return `/book#teams/${chapter.team}`;
  return chapter.category === "all" ? "/book#achievements" : `/book#achievements/${chapter.category}`;
}

export function chapterKeyOf(chapter: Chapter) {
  if (chapter.kind === "team") return `team:${chapter.team}`;
  if (chapter.kind === "achievements") return `achievements:${chapter.category}`;
  return chapter.kind;
}

export function sectionOf(chapter: Chapter): Section {
  return chapter.kind === "team" ? "teams" : chapter.kind;
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

const currentHash = () => window.location.hash;

export function useChapter(fallback?: Chapter): Chapter {
  return chapterOf(useSyncExternalStore(subscribe, currentHash, () => ""), fallback);
}
