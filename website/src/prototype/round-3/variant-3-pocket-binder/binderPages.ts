// PROTOTYPE (#625, round 3): the binder's sleeve pages, sections and the hash that names each spread. Never merge to main.
import type { Rarity } from "../../../../../convex/hoggies/catalogue";
import type { Album, Hoggie, Team } from "../album";

export const pocketsPerSheet = 9;

export const rarityOrder: Rarity[] = ["legendary", "epic", "rare", "uncommon", "common"];

export const rarityWords: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

const teamPalette = ["#1D4AFF", "#F54E00", "#B62AD9", "#1E8C78", "#C27A00", "#2F6FD6", "#D2366B", "#5A6B23"];

export type TeamPocket = { kind: "crest" } | { kind: "person"; key: string };

export type Sheet =
  | { kind: "cover" }
  | { kind: "contents" }
  | { kind: "team"; team: Team; colour: string; pockets: TeamPocket[]; part: number; parts: number }
  | { kind: "hoggies"; rarity: Rarity; pockets: Hoggie[]; part: number; parts: number; found: number; total: number }
  | { kind: "blank" };

export type Section = { id: string; label: string; colour: string; sheet: number; held: number; total: number; complete: boolean };

export type Binder = { sheets: Sheet[]; sections: Section[]; spreads: number };

export function teamColourOf(album: Album, team: string) {
  const index = album.teams.findIndex((entry) => entry.team === team);
  return teamPalette[Math.max(0, index) % teamPalette.length]!;
}

function chunked<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.max(1, Math.ceil(items.length / size)) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

export function binderOf(album: Album): Binder {
  const sheets: Sheet[] = [{ kind: "cover" }, { kind: "contents" }];
  const sections: Section[] = [];
  for (const team of album.teams) {
    const colour = teamColourOf(album, team.team);
    const pockets: TeamPocket[] = [{ kind: "crest" }, ...team.people.map((key) => ({ kind: "person" as const, key }))];
    const parts = chunked(pockets, pocketsPerSheet);
    sections.push({ id: `teams/${team.team}`, label: team.name, colour, sheet: sheets.length, held: team.held, total: team.total, complete: team.complete });
    parts.forEach((part, index) => sheets.push({ kind: "team", team, colour, pockets: part, part: index + 1, parts: parts.length }));
  }
  for (const rarity of rarityOrder) {
    const ofRarity = album.hoggies.filter((hoggie) => hoggie.rarity === rarity).toSorted((first, second) => Number(second.count > 0) - Number(first.count > 0));
    const found = ofRarity.filter(({ count }) => count > 0).length;
    const parts = chunked(ofRarity, pocketsPerSheet);
    sections.push({ id: `hoggies/${rarity}`, label: rarityWords[rarity], colour: `var(--rarity-${rarity})`, sheet: sheets.length, held: found, total: ofRarity.length, complete: found === ofRarity.length });
    parts.forEach((part, index) => sheets.push({ kind: "hoggies", rarity, pockets: part, part: index + 1, parts: parts.length, found, total: ofRarity.length }));
  }
  if (sheets.length % 2 === 1) sheets.push({ kind: "blank" });
  return { sheets, sections, spreads: sheets.length / 2 };
}

export type Place = { kind: "binder"; spread: number; lifted: string | null } | { kind: "packs"; pack: string | null };

export function hashNow() {
  return decodeURIComponent(window.location.hash.replace(/^#/, ""));
}

export function placeOf(binder: Binder, album: Album, hash: string): Place {
  const [head, ...rest] = hash.split("/");
  const tail = rest.join("/");
  if (head === "packs") return { kind: "packs", pack: tail === "" ? null : tail };
  if (head === "people") return { kind: "binder", spread: spreadOfPerson(binder, album, tail), lifted: album.people.some(({ key }) => key === tail) ? tail : null };
  if (head === "page") return { kind: "binder", spread: clampSpread(binder, Math.floor((Number(tail) - 1) / 2)), lifted: null };
  if (head === "hoggies") return { kind: "binder", spread: spreadOfSection(binder, tail === "" ? `hoggies/${rarityOrder[0]}` : `hoggies/${tail}`), lifted: null };
  if (head === "teams") return { kind: "binder", spread: spreadOfSection(binder, `teams/${tail}`), lifted: null };
  return { kind: "binder", spread: 0, lifted: null };
}

function clampSpread(binder: Binder, spread: number) {
  return Number.isFinite(spread) ? Math.min(Math.max(0, spread), binder.spreads - 1) : 0;
}

export function spreadOfSection(binder: Binder, id: string) {
  const section = binder.sections.find((entry) => entry.id === id);
  return section === undefined ? 0 : Math.floor(section.sheet / 2);
}

export function sheetOfPerson(binder: Binder, album: Album, key: string) {
  const team = album.people.find((person) => person.key === key)?.teams[0];
  const index = binder.sheets.findIndex((sheet) => sheet.kind === "team" && sheet.team.team === team && sheet.pockets.some((pocket) => pocket.kind === "person" && pocket.key === key));
  return Math.max(0, index);
}

export function sheetOfHoggie(binder: Binder, slug: string) {
  return Math.max(0, binder.sheets.findIndex((sheet) => sheet.kind === "hoggies" && sheet.pockets.some(({ hoggie }) => hoggie === slug)));
}

function spreadOfPerson(binder: Binder, album: Album, key: string) {
  return Math.floor(sheetOfPerson(binder, album, key) / 2);
}

export function hashOfSpread(binder: Binder, spread: number) {
  if (spread === 0) return "";
  const starting = binder.sections.find(({ sheet }) => Math.floor(sheet / 2) === spread);
  return starting === undefined ? `page/${spread * 2 + 1}` : starting.id;
}

export function sectionAt(binder: Binder, spread: number) {
  return binder.sections.findLast(({ sheet }) => sheet <= spread * 2) ?? null;
}

export function bookHref(hash: string) {
  return hash === "" ? "/book" : `/book#${hash}`;
}
