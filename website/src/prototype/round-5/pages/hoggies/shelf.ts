// PROTOTYPE (#625, round 5): the hoggie facts the hoggies page reads: rarity shelves, odds, numbers, dates and the filters. Never merge to main.
import type { CSSProperties } from "react";
import { personOf, rarityWeights, type Album, type Hoggie } from "../../../round-3/album";

export type Rarity = Hoggie["rarity"];

export type Shelf = { rarity: Rarity; hoggies: Hoggie[]; found: number; shareOfRolls: number };

export const rarityWords: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

const rarityRank: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

export function rarityTint(rarity: Rarity) {
  return { "--r5h-rarity": `var(--rarity-${rarity})` } as CSSProperties;
}

export function isFound(hoggie: Hoggie) {
  return hoggie.count > 0;
}

export function hasSpares(hoggie: Hoggie) {
  return hoggie.count > 1;
}

export function foundIn(hoggies: Hoggie[]) {
  return hoggies.filter(isFound).length;
}

export function shelvesOf(hoggies: Hoggie[]): Shelf[] {
  return rarityWeights.map(({ rarity, weight }) => {
    const onShelf = hoggies.filter((hoggie) => hoggie.rarity === rarity);
    return { rarity, hoggies: onShelf, found: foundIn(onShelf), shareOfRolls: weight };
  });
}

export function shelfOf(rarity: Rarity, hoggies: Hoggie[]) {
  return shelvesOf(hoggies).find((shelf) => shelf.rarity === rarity)!;
}

export function oddsWords(hoggie: Hoggie, hoggies: Hoggie[]) {
  const shelf = shelfOf(hoggie.rarity, hoggies);
  return `About 1 in ${Math.round((100 * shelf.hoggies.length) / shelf.shareOfRolls)} rolls`;
}

export function numberOf(hoggie: Hoggie, hoggies: Hoggie[]) {
  return `No. ${String(hoggies.indexOf(hoggie) + 1).padStart(3, "0")}`;
}

export function copiesWords(count: number) {
  if (count === 0) return "None yet";
  return count === 1 ? "One copy" : `${count} copies`;
}

const dayMonthYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export function dateWords(at: number) {
  return dayMonthYear.format(at);
}

export function shortDateWords(at: number) {
  return dayMonth.format(at);
}

export function lastRolledFrom(album: Album, hoggie: Hoggie) {
  const moment = album.moments.find((entry) => entry.kind === "pack-opened" && entry.hoggie === hoggie.hoggie);
  return moment === undefined ? null : (personOf(album, moment.person)?.name ?? null);
}

export function rarestFinds(hoggies: Hoggie[], shown: number) {
  return hoggies.filter(isFound).toSorted((first, second) => rarityRank[second.rarity] - rarityRank[first.rarity] || second.firstAt! - first.firstAt!).slice(0, shown);
}

export function latestFind(hoggies: Hoggie[]) {
  return hoggies.filter(isFound).toSorted((first, second) => second.firstAt! - first.firstAt!)[0] ?? null;
}

export function mostCopies(hoggies: Hoggie[]) {
  return hoggies.toSorted((first, second) => second.count - first.count)[0] ?? null;
}

export function hoggieLabel(hoggie: Hoggie) {
  if (!isFound(hoggie)) return `Not found yet, a ${rarityWords[hoggie.rarity].toLowerCase()} hoggie`;
  return `${hoggie.name}, ${rarityWords[hoggie.rarity]}, ${copiesWords(hoggie.count).toLowerCase()}`;
}

export const filters = {
  all: { words: "All", keeps: () => true, none: "No hoggies in the album yet." },
  found: { words: "Found", keeps: isFound, none: "Nothing found yet. Open a pack and its hoggie lands here." },
  hidden: { words: "Still hidden", keeps: (hoggie: Hoggie) => !isFound(hoggie), none: "Every hoggie found. The whole collection is yours." },
  spares: { words: "Spares", keeps: hasSpares, none: "No spares yet. They show up once a pack rolls a hoggie you already have." },
} satisfies Record<string, { words: string; keeps: (hoggie: Hoggie) => boolean; none: string }>;

export type Filter = keyof typeof filters;

export const filterKeys = Object.keys(filters) as Filter[];

export function keptBy(filter: Filter, hoggies: Hoggie[]) {
  return hoggies.filter(filters[filter].keeps);
}
