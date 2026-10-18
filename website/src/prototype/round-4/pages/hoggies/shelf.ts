// PROTOTYPE (#625, round 4): the hoggie facts every hoggies layout reads: rarity shelves, odds, numbers, dates and the chosen hoggie in the URL. Never merge to main.
import { useCallback, type CSSProperties } from "react";
import { personOf, rarityWeights, type Album, type Hoggie } from "../../../round-3/album";
import { useHash } from "../../address";

export type Rarity = Hoggie["rarity"];

export type Shelf = { rarity: Rarity; hoggies: Hoggie[]; found: number; shareOfRolls: number };

export const rarityWords: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

const rarityRank: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

export function rarityTint(rarity: Rarity) {
  return { "--r4h-rarity": `var(--rarity-${rarity})` } as CSSProperties;
}

export function isFound(hoggie: Hoggie) {
  return hoggie.count > 0;
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

export function oddsWords(hoggie: Hoggie, hoggies: Hoggie[]) {
  const shelf = shelvesOf(hoggies).find(({ rarity }) => rarity === hoggie.rarity)!;
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

const openedHere = "r4hHoggieOpened";

function chosenIn(hash: string) {
  const [section, ...rest] = decodeURIComponent(hash.replace(/^#/, "")).split("/");
  return section === "hoggies" && rest.length > 0 ? rest.join("/") : null;
}

function addressWith(hash: string) {
  return `${window.location.pathname}${window.location.search}${hash}`;
}

function announceTheHash() {
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function openedOnThisPage() {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null && openedHere in state;
}

export function useChosenHoggie(hoggies: Hoggie[]) {
  const chosenSlug = chosenIn(useHash());
  const chosen = hoggies.find(({ hoggie }) => hoggie === chosenSlug) ?? null;
  const choose = useCallback((hoggie: Hoggie) => {
    const address = addressWith(`#hoggies/${encodeURIComponent(hoggie.hoggie)}`);
    if (chosenIn(window.location.hash) === null) window.history.pushState({ [openedHere]: true }, "", address);
    else window.history.replaceState(window.history.state, "", address);
    announceTheHash();
  }, []);
  const close = useCallback(() => {
    if (chosenIn(window.location.hash) === null) return;
    if (openedOnThisPage()) {
      window.history.back();
      return;
    }
    window.history.replaceState(null, "", addressWith("#hoggies"));
    announceTheHash();
  }, []);
  return { chosen, choose, close };
}
