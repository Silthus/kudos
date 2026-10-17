// PROTOTYPE (#625): the one inventory: hoggies, team stickers (leads bigger) and packs, smart tabs that filter and player-made tabs. Never merge to main.
import { useCallback, useState } from "react";
import type { CollectionHoggie, CollectionTeamPage, CollectionTeamPerson } from "../../../collectionRead";
import type { Rarity } from "../../../shell";
import type { Pack, World } from "../../world";
import { rarityRank } from "./looks";

export type Item =
  | { kind: "hoggie"; key: string; size: [number, number]; rarity: Rarity; name: string; recent: boolean; hoggie: CollectionHoggie }
  | { kind: "sticker"; key: string; size: [number, number]; rarity: Rarity; name: string; recent: boolean; person: CollectionTeamPerson; teams: CollectionTeamPage[] }
  | { kind: "pack"; key: string; size: [number, number]; rarity: Rarity; name: string; recent: boolean; pack: Pack };

export type SmartTabId = "all" | "packs" | "rare" | "stickers" | "new";

export type CustomTab = { id: string; name: string; keys: string[] };

export const smartTabs: { id: SmartTabId; label: string; icon: string; holds: (item: Item, fresh: ReadonlySet<string>) => boolean }[] = [
  { id: "all", label: "All", icon: "▦", holds: () => true },
  { id: "packs", label: "Packs", icon: "✉", holds: (item) => item.kind === "pack" },
  { id: "rare", label: "Rare+", icon: "◆", holds: (item) => item.kind === "hoggie" && rarityRank[item.rarity] >= rarityRank.rare },
  { id: "stickers", label: "Team stickers", icon: "☺", holds: (item) => item.kind === "sticker" },
  { id: "new", label: "New", icon: "✦", holds: (item, fresh) => item.recent || fresh.has(item.key) },
];

const recentDays = 10;

function isRecent(at: number | null) {
  return at !== null && Date.now() - at < recentDays * 24 * 60 * 60 * 1000;
}

export function itemsOf(world: World): Item[] {
  const packs = world.packs.map((pack): Item => ({ kind: "pack", key: pack.id, size: [1, 2], rarity: "epic", name: "Pack", recent: false, pack }));
  return [...packs, ...stickersOf(world), ...hoggiesOf(world)];
}

function stickersOf(world: World): Item[] {
  const people = new Map<string, { person: CollectionTeamPerson; teams: CollectionTeamPage[] }>();
  for (const team of world.teams)
    for (const person of team.people.filter(({ held }) => held)) {
      const known = people.get(person.key);
      if (known === undefined) people.set(person.key, { person, teams: [team] });
      else people.set(person.key, { person: { ...known.person, lead: known.person.lead || person.lead }, teams: [...known.teams, team] });
    }
  return [...people.values()]
    .toSorted((first, second) => Number(second.person.lead) - Number(first.person.lead))
    .map(({ person, teams }): Item => ({ kind: "sticker", key: `sticker:${person.key}`, size: person.lead ? [2, 2] : [1, 1], rarity: "uncommon", name: person.name, recent: isRecent(person.heldAt), person, teams }));
}

function hoggiesOf(world: World): Item[] {
  return world.hoggies
    .filter(({ count }) => count > 0)
    .toSorted((first, second) => rarityRank[second.rarity] - rarityRank[first.rarity] || (second.firstAt ?? 0) - (first.firstAt ?? 0))
    .map((hoggie): Item => ({ kind: "hoggie", key: `hoggie:${hoggie.hoggie}`, size: [1, 1], rarity: hoggie.rarity, name: hoggie.name, recent: isRecent(hoggie.firstAt), hoggie }));
}

export function arranged(items: Item[], order: readonly string[]) {
  const place = new Map(order.map((key, index) => [key, index]));
  return items.toSorted((first, second) => (place.get(first.key) ?? -1) - (place.get(second.key) ?? -1));
}

function moved(keys: readonly string[], key: string, before: string | null) {
  const without = keys.filter((each) => each !== key);
  const at = before === null ? without.length : without.indexOf(before);
  return [...without.slice(0, at < 0 ? without.length : at), key, ...without.slice(at < 0 ? without.length : at)];
}

let tabSerial = 1;

export type TabId = SmartTabId | `custom:${string}`;

export function useInventory(world: World) {
  const [order, setOrder] = useState<string[]>(() => itemsOf(world).map(({ key }) => key));
  const [custom, setCustom] = useState<CustomTab[]>(() => [{ id: "custom:favourites", name: "Favourites", keys: favouritesOf(world) }]);
  const [active, setActive] = useState<TabId>("all");

  const addTab = useCallback(() => {
    tabSerial += 1;
    const tab: CustomTab = { id: `custom:${tabSerial}`, name: `Tab ${tabSerial}`, keys: [] };
    setCustom((tabs) => [...tabs, tab]);
    setActive(tab.id as TabId);
    return tab.id;
  }, []);

  const renameTab = useCallback((id: string, name: string) => setCustom((tabs) => tabs.map((tab) => (tab.id === id ? { ...tab, name: name.trim() || tab.name } : tab))), []);

  const deleteTab = useCallback((id: string) => {
    setCustom((tabs) => tabs.filter((tab) => tab.id !== id));
    setActive("all");
  }, []);

  const putInto = useCallback((id: string, key: string, from: TabId) => {
    setCustom((tabs) =>
      tabs.map((tab) => {
        if (tab.id === id) return tab.keys.includes(key) ? tab : { ...tab, keys: [...tab.keys, key] };
        if (tab.id === from) return { ...tab, keys: tab.keys.filter((each) => each !== key) };
        return tab;
      }),
    );
  }, []);

  const takeOut = useCallback((id: string, key: string) => setCustom((tabs) => tabs.map((tab) => (tab.id === id ? { ...tab, keys: tab.keys.filter((each) => each !== key) } : tab))), []);

  const reorder = useCallback((tab: TabId, key: string, before: string | null, everyKey: readonly string[]) => {
    if (tab.startsWith("custom:")) setCustom((tabs) => tabs.map((each) => (each.id === tab ? { ...each, keys: moved(each.keys, key, before) } : each)));
    else setOrder(moved(everyKey, key, before));
  }, []);

  return { order, custom, active, setActive, addTab, renameTab, deleteTab, putInto, takeOut, reorder };
}

export type InventoryState = ReturnType<typeof useInventory>;

function favouritesOf(world: World) {
  const items = itemsOf(world);
  const lead = items.find((item) => item.kind === "sticker" && item.person.lead);
  const best = items.filter((item) => item.kind === "hoggie").slice(0, 2);
  return [...(lead === undefined ? [] : [lead]), ...best].map(({ key }) => key);
}
