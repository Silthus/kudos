import type { CSSProperties } from "react";
import type { Rarity } from "../shell";
import type { AlbumHoggie, AlbumHoggies, AlbumRarity } from "./answer";
import { rarityWordOf } from "./opening";

export type Shelf = AlbumRarity & { hoggies: AlbumHoggie[] };

export const filters = {
  all: { words: "All", keeps: () => true, none: "No hoggies in the album yet." },
  found: { words: "Found", keeps: (hoggie: AlbumHoggie) => hoggie.found, none: "Nothing found yet. Open a pack and its hoggie lands here." },
  hidden: { words: "Still hidden", keeps: (hoggie: AlbumHoggie) => !hoggie.found, none: "Every hoggie found. The whole collection is yours." },
  spares: { words: "Spares", keeps: (hoggie: AlbumHoggie) => hoggie.spares > 0, none: "No spares yet. They show up once a pack rolls a hoggie you already have." },
} satisfies Record<string, { words: string; keeps: (hoggie: AlbumHoggie) => boolean; none: string }>;

export type Filter = keyof typeof filters;

export const filterKeys = Object.keys(filters) as Filter[];

export function keptBy(filter: Filter, hoggies: AlbumHoggie[], rarity?: Rarity) {
  return hoggies.filter((hoggie) => filters[filter].keeps(hoggie) && (rarity === undefined || hoggie.rarity === rarity));
}

export function shelvesOf(answer: AlbumHoggies, hoggies: AlbumHoggie[]): Shelf[] {
  return answer.rarities.map((rarity) => ({ ...rarity, hoggies: hoggies.filter((hoggie) => hoggie.rarity === rarity.rarity) }));
}

export function groupIdOf(rarity: Rarity) {
  return `al-hoggies-${rarity}`;
}

export function rarityTintOf(rarity: Rarity) {
  return { "--al-rarity": `var(--rarity-${rarity})`, "--al-rarity-ink": `var(--al-ink-${rarity})` } as CSSProperties;
}

export function numberOf(hoggie: AlbumHoggie, answer: AlbumHoggies) {
  return `No. ${String(answer.hoggies.indexOf(hoggie) + 1).padStart(3, "0")}`;
}

export function copiesWords(count: number) {
  return count === 1 ? "one copy" : `${count} copies`;
}

export function oddsWords(hoggie: AlbumHoggie, answer: AlbumHoggies) {
  const rarity = answer.rarities.find((listed) => listed.rarity === hoggie.rarity);
  if (rarity === undefined || rarity.chance === 0) return "Not in packs right now";
  return `About 1 in ${Math.round((100 * rarity.total) / rarity.chance)} rolls`;
}

export function hoggieLabelOf(hoggie: AlbumHoggie) {
  if (!hoggie.found) return `Not found yet, a ${rarityWordOf(hoggie.rarity).toLowerCase()} hoggie`;
  return `${hoggie.name}, ${rarityWordOf(hoggie.rarity)}, ${copiesWords(hoggie.count)}`;
}

export function hoggieNameShownOf(hoggie: AlbumHoggie) {
  return hoggie.found ? hoggie.name : "Not found yet";
}
