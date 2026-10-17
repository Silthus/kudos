import type { Face, ProfileChoice } from "../shell";

export function searchTextOf(...words: Array<string | null>): string {
  return foldedOf(words.filter((word) => word !== null).join(" "));
}

export function isFoundBy(text: string, search: string): boolean {
  return foldedOf(search)
    .split(/\s+/)
    .every((term) => text.includes(term));
}

export function personSearchTextOf({ name, role, teams }: ProfileChoice): string {
  return searchTextOf(name, role, ...teams);
}

export function faceOfPerson({ name, face }: ProfileChoice): Face {
  const initials = initialsOf(name);
  return face === null ? { kind: "initials", initials } : { kind: "company-profile", ...face, initials };
}

export function aboutPersonOf({ role, teams }: ProfileChoice): string {
  return [role, teams.join(", ")].filter((part) => part !== null && part !== "").join(" · ");
}

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/);
  return [words[0], words.length > 1 ? words.at(-1) : undefined].map((word) => word?.[0]?.toUpperCase() ?? "").join("");
}

function foldedOf(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
