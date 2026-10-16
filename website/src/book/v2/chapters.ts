import { useSyncExternalStore } from "react";
import type { Rarity } from "../../crates/drops";

export type Chapter = { kind: "cover" } | { kind: "hoggies"; rarity: Rarity } | { kind: "teams" } | { kind: "team"; team: string };

export type ChapterId = Chapter["kind"];

const rarities: Rarity[] = ["legendary", "epic", "rare", "uncommon", "common"];

export function chapterOf(hash: string): Chapter {
  const [head, tail] = hash.replace(/^#/, "").split("/");
  if (head === "hoggies") return { kind: "hoggies", rarity: rarities.find((rarity) => rarity === tail) ?? "legendary" };
  if (head === "teams") return tail ? { kind: "team", team: tail } : { kind: "teams" };
  return { kind: "cover" };
}

export function chapterHref(chapter: Chapter) {
  if (chapter.kind === "cover") return "/book/collection";
  if (chapter.kind === "hoggies") return `/book/collection#hoggies/${chapter.rarity}`;
  return chapter.kind === "teams" ? "/book/collection#teams" : `/book/collection#teams/${chapter.team}`;
}

export function chapterKeyOf(chapter: Chapter) {
  return chapter.kind === "team" ? `team:${chapter.team}` : chapter.kind;
}

export function sectionOf(chapter: Chapter): "cover" | "hoggies" | "teams" {
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

export function useChapter(): Chapter {
  return chapterOf(useSyncExternalStore(subscribe, currentHash, () => ""));
}
