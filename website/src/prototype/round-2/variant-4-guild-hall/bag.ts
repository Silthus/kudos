// PROTOTYPE (#625) round 2 variant 4: the guild bank bag: items from the world, player-made tabs, moves, reorders and sorting. Never merge to main.
import type { CollectionHoggie, CollectionTeamPage, CollectionTeamPerson } from "../../../collectionRead";
import { rarityOrder, type Pack, type World } from "../../world";

export type Size = [number, number];

export type BagItem =
  | { kind: "hoggie"; key: string; size: Size; name: string; hoggie: CollectionHoggie }
  | { kind: "sticker"; key: string; size: Size; name: string; team: CollectionTeamPage; person: CollectionTeamPerson }
  | { kind: "crest"; key: string; size: Size; name: string; team: CollectionTeamPage }
  | { kind: "pack"; key: string; size: Size; name: string; pack: Pack };

export type TabIcon = "star" | "heart" | "party" | "money" | "wizard" | "explorer" | "reading" | "group";

export const tabIcons: TabIcon[] = ["star", "heart", "party", "money", "wizard", "explorer", "reading", "group"];

export type BagTab = { id: string; name: string; icon: TabIcon };

export type BagState = { tabs: BagTab[]; active: string; placed: Record<string, string>; order: Record<string, string[]>; serial: number };

export type BagAction =
  | { type: "select"; tab: string }
  | { type: "add" }
  | { type: "rename"; tab: string; name: string }
  | { type: "icon"; tab: string; icon: TabIcon }
  | { type: "remove"; tab: string }
  | { type: "move"; key: string; tab: string }
  | { type: "reorder"; key: string; before: string | null; shown: string[] }
  | { type: "sort"; shown: BagItem[] };

const homeTabOf: Record<BagItem["kind"], string> = { hoggie: "tab:hoggies", sticker: "tab:team", crest: "tab:team", pack: "tab:packs" };

export function initialBag(): BagState {
  return {
    tabs: [
      { id: "tab:hoggies", name: "Hoggies", icon: "star" },
      { id: "tab:team", name: "Team stickers", icon: "heart" },
      { id: "tab:packs", name: "Packs", icon: "party" },
    ],
    active: "tab:hoggies",
    placed: {},
    order: {},
    serial: 0,
  };
}

const bigRarities = new Set(["epic", "legendary"]);

export function itemsOf(world: World): BagItem[] {
  const hoggies = world.hoggies
    .filter(({ count }) => count > 0)
    .toSorted((first, second) => (first.firstAt ?? Number.MAX_SAFE_INTEGER) - (second.firstAt ?? Number.MAX_SAFE_INTEGER))
    .map((hoggie): BagItem => ({ kind: "hoggie", key: `hoggie:${hoggie.hoggie}`, size: bigRarities.has(hoggie.rarity) ? [2, 2] : [1, 1], name: hoggie.name, hoggie }));
  const crests = world.teams.filter(({ crest, complete }) => crest !== null || complete).map((team): BagItem => ({ kind: "crest", key: `crest:${team.team}`, size: [2, 2], name: `${team.name} crest`, team }));
  const stickers = world.teams.flatMap((team) => team.people.filter(({ held }) => held).map((person): BagItem => ({ kind: "sticker", key: `sticker:${team.team}:${person.key}`, size: person.lead ? [2, 2] : [1, 1], name: person.name, team, person })));
  const packs = world.packs.map((pack): BagItem => ({ kind: "pack", key: pack.id, size: [1, 2], name: packName[pack.kind], pack }));
  return [...hoggies, ...crests, ...stickers, ...packs];
}

export const packName: Record<Pack["kind"], string> = { journey: "Journey pack", weekly: "Weekly pack", group: "Team pack", bought: "Shop pack" };

export function tabOf(state: BagState, item: BagItem) {
  const placed = state.placed[item.key];
  if (placed !== undefined && state.tabs.some(({ id }) => id === placed)) return placed;
  const home = homeTabOf[item.kind];
  return state.tabs.some(({ id }) => id === home) ? home : state.tabs[0]!.id;
}

export function itemsIn(state: BagState, items: BagItem[], tab: string) {
  const here = items.filter((item) => tabOf(state, item) === tab);
  const order = state.order[tab] ?? [];
  const rank = (key: string) => {
    const at = order.indexOf(key);
    return at < 0 ? order.length : at;
  };
  return here.map((item, natural) => ({ item, natural })).toSorted((first, second) => rank(first.item.key) - rank(second.item.key) || first.natural - second.natural).map(({ item }) => item);
}

export function cellsOf(items: BagItem[]) {
  return items.reduce((sum, { size: [width, height] }) => sum + width * height, 0);
}

export function bagReducer(state: BagState, action: BagAction): BagState {
  switch (action.type) {
    case "select":
      return { ...state, active: action.tab };
    case "add": {
      const serial = state.serial + 1;
      const tab: BagTab = { id: `tab:own:${serial}`, name: `Tab ${state.tabs.length + 1}`, icon: tabIcons[(state.tabs.length + 3) % tabIcons.length]! };
      return { ...state, serial, tabs: [...state.tabs, tab], active: tab.id };
    }
    case "rename":
      return { ...state, tabs: state.tabs.map((tab) => (tab.id === action.tab ? { ...tab, name: action.name } : tab)) };
    case "icon":
      return { ...state, tabs: state.tabs.map((tab) => (tab.id === action.tab ? { ...tab, icon: action.icon } : tab)) };
    case "remove": {
      if (state.tabs.length <= 1) return state;
      const tabs = state.tabs.filter(({ id }) => id !== action.tab);
      const placed = Object.fromEntries(Object.entries(state.placed).filter(([, tab]) => tab !== action.tab));
      return { ...state, tabs, placed, active: state.active === action.tab ? tabs[0]!.id : state.active };
    }
    case "move": {
      const order = Object.fromEntries(Object.entries(state.order).map(([tab, keys]) => [tab, keys.filter((key) => key !== action.key)]));
      return { ...state, placed: { ...state.placed, [action.key]: action.tab }, order: { ...order, [action.tab]: [...(order[action.tab] ?? []), action.key] } };
    }
    case "reorder": {
      if (action.key === action.before) return state;
      const rest = action.shown.filter((key) => key !== action.key);
      const at = action.before === null ? rest.length : Math.max(0, rest.indexOf(action.before));
      return { ...state, order: { ...state.order, [state.active]: [...rest.slice(0, at), action.key, ...rest.slice(at)] } };
    }
    case "sort":
      return { ...state, order: { ...state.order, [state.active]: action.shown.toSorted(bySortRank).map(({ key }) => key) } };
  }
}

function sortRank(item: BagItem) {
  if (item.kind === "pack") return 0;
  if (item.kind === "crest") return 1;
  if (item.kind === "sticker") return item.person.lead ? 2 : 9;
  return 3 + (rarityOrder.length - 1 - rarityOrder.indexOf(item.hoggie.rarity));
}

function bySortRank(first: BagItem, second: BagItem) {
  return sortRank(first) - sortRank(second) || second.size[0] * second.size[1] - first.size[0] * first.size[1] || first.name.localeCompare(second.name);
}
