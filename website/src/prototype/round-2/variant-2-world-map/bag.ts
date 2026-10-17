// PROTOTYPE (#625): the inventory's model: every item the player holds, and the player's own tabs, order and sorting. Never merge to main.
import { useState } from "react";
import type { CollectionHoggie, CollectionTeamPage, CollectionTeamPerson } from "../../../collectionRead";
import type { Pack, World } from "../../world";

export const everything = "all";

export type BagTab = { id: string; name: string; icon: string; colour: string };

export type Bag = { tabs: BagTab[]; home: Record<string, string>; order: string[] };

export type Item =
  | { key: string; kind: "hoggie"; size: [number, number]; hoggie: CollectionHoggie }
  | { key: string; kind: "sticker"; size: [number, number]; person: CollectionTeamPerson; team: CollectionTeamPage }
  | { key: string; kind: "crest"; size: [number, number]; team: CollectionTeamPage }
  | { key: string; kind: "pack"; size: [number, number]; pack: Pack };

export const tabIcons = ["★", "♥", "⚑", "✿", "◆", "☀", "☾", "♣", "✉", "⚔"];

export const tabColours = ["#f54e00", "#1d4aff", "#2f8a3a", "#a335ee", "#f7a501", "#d23f6e", "#0e8a8a", "#6b4320"];

export function itemsOf(world: World): Item[] {
  const packs: Item[] = world.packs.map((pack) => ({ key: pack.id, kind: "pack", size: [1, 2], pack }));
  const crests: Item[] = world.teams.filter(({ complete, crest }) => complete || crest !== null).map((team) => ({ key: `crest:${team.team}`, kind: "crest", size: [2, 2], team }));
  const stickers: Item[] = world.teams.flatMap((team) => team.people.filter(({ held }) => held).map((person): Item => ({ key: `sticker:${team.team}:${person.key}`, kind: "sticker", size: person.lead ? [2, 2] : [1, 1], person, team })));
  const hoggies: Item[] = world.hoggies.filter(({ count }) => count > 0).map((hoggie) => ({ key: `hoggie:${hoggie.hoggie}`, kind: "hoggie", size: [1, 1], hoggie }));
  return [...packs, ...crests, ...stickers, ...hoggies];
}

function seededBag(world: World): Bag {
  const mine = world.teams.find(({ mine: isMine }) => isMine)?.team;
  const home: Record<string, string> = {};
  for (const item of itemsOf(world)) {
    if (item.kind === "pack") home[item.key] = "packs";
    if (item.kind === "sticker" && item.team.team === mine) home[item.key] = "team";
    if (item.kind === "hoggie" && (item.hoggie.rarity === "epic" || item.hoggie.rarity === "legendary")) home[item.key] = "rare";
  }
  return {
    tabs: [
      { id: everything, name: "Everything", icon: "✦", colour: "#8b6a3a" },
      { id: "packs", name: "Packs", icon: "◆", colour: "#f54e00" },
      { id: "team", name: "My team", icon: "⚑", colour: "#1d4aff" },
      { id: "rare", name: "Treasures", icon: "★", colour: "#a335ee" },
    ],
    home,
    order: [],
  };
}

export function useBag(world: World) {
  return useState(() => seededBag(world));
}

export function sortedIn(bag: Bag, items: Item[]) {
  const rankOf = (key: string, natural: number) => {
    const ranked = bag.order.indexOf(key);
    return ranked === -1 ? bag.order.length + natural : ranked;
  };
  return items.map((item, natural) => ({ item, rank: rankOf(item.key, natural) })).toSorted((first, second) => first.rank - second.rank).map(({ item }) => item);
}

export function shownIn(bag: Bag, items: Item[], tab: string) {
  const sorted = sortedIn(bag, items);
  return tab === everything ? sorted : sorted.filter(({ key }) => bag.home[key] === tab);
}

export function movedToTab(bag: Bag, key: string, tab: string): Bag {
  const home = { ...bag.home };
  if (tab === everything) delete home[key];
  else home[key] = tab;
  return { ...bag, home };
}

export function movedBefore(bag: Bag, items: Item[], key: string, before: string | null): Bag {
  const keys = sortedIn(bag, items)
    .map((item) => item.key)
    .filter((each) => each !== key);
  const at = before === null ? keys.length : keys.indexOf(before);
  keys.splice(at === -1 ? keys.length : at, 0, key);
  return { ...bag, order: keys };
}

export function tabMovedBefore(bag: Bag, id: string, before: string): Bag {
  if (id === everything || id === before) return bag;
  const tabs = bag.tabs.filter((tab) => tab.id !== id);
  const moving = bag.tabs.find((tab) => tab.id === id)!;
  const at = Math.max(1, tabs.findIndex((tab) => tab.id === before));
  tabs.splice(at, 0, moving);
  return { ...bag, tabs };
}

export function withTab(bag: Bag, tab: BagTab): Bag {
  const exists = bag.tabs.some(({ id }) => id === tab.id);
  return { ...bag, tabs: exists ? bag.tabs.map((each) => (each.id === tab.id ? tab : each)) : [...bag.tabs, tab] };
}

export function withoutTab(bag: Bag, id: string): Bag {
  if (id === everything) return bag;
  const home = Object.fromEntries(Object.entries(bag.home).filter(([, tab]) => tab !== id));
  return { ...bag, tabs: bag.tabs.filter((tab) => tab.id !== id), home };
}

export function nameOf(item: Item) {
  if (item.kind === "hoggie") return item.hoggie.name;
  if (item.kind === "sticker") return item.person.name;
  if (item.kind === "crest") return `${item.team.name} crest`;
  return "Pack";
}
