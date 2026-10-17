// PROTOTYPE (#625): the inventory as WoW bags: player-made bags, items placed in order, moves between bags, all in memory. Never merge to main.
import { useCallback, useMemo, useState } from "react";
import type { CollectionHoggie, CollectionTeamPage, CollectionTeamPerson } from "../../../collectionRead";
import type { Pack, World } from "../../world";

export type BagIcon = "backpack" | "satchel" | "pouch" | "chest" | "basket";

export const bagIcons: BagIcon[] = ["backpack", "satchel", "pouch", "chest", "basket"];

export type Bag = { id: string; name: string; icon: BagIcon; open: boolean; capacity: number; starter: boolean };

export type Item =
  | { kind: "hoggie"; key: string; home: string; span: [number, number]; hoggie: CollectionHoggie }
  | { kind: "sticker"; key: string; home: string; span: [number, number]; person: CollectionTeamPerson; team: CollectionTeamPage }
  | { kind: "crest"; key: string; home: string; span: [number, number]; team: CollectionTeamPage }
  | { kind: "pack"; key: string; home: string; span: [number, number]; pack: Pack };

export const columns = 8;

const starterBags: Bag[] = [
  { id: "backpack", name: "Backpack", icon: "backpack", open: true, capacity: 48, starter: true },
  { id: "stickers", name: "Team stickers", icon: "satchel", open: false, capacity: 40, starter: true },
  { id: "pouch", name: "Pack pouch", icon: "pouch", open: false, capacity: 16, starter: true },
];

export const packHome = "pouch";

export function itemsOf(world: World): Item[] {
  const hoggies = world.hoggies
    .filter(({ count }) => count > 0)
    .toSorted((first, second) => (first.firstAt ?? Number.MAX_SAFE_INTEGER) - (second.firstAt ?? Number.MAX_SAFE_INTEGER))
    .map((hoggie): Item => ({ kind: "hoggie", key: `hoggie:${hoggie.hoggie}`, home: "backpack", span: [1, 1], hoggie }));
  const crests = world.teams.filter(({ crest, complete }) => crest !== null || complete).map((team): Item => ({ kind: "crest", key: `crest:${team.team}`, home: "stickers", span: [2, 2], team }));
  const stickers = world.teams.flatMap((team) => team.people.filter(({ held }) => held).map((person): Item => ({ kind: "sticker", key: `sticker:${team.team}:${person.key}`, home: "stickers", span: person.lead ? [2, 2] : [1, 1], person, team })));
  const packs = world.packs.map((pack): Item => ({ kind: "pack", key: pack.id, home: packHome, span: [1, 2], pack }));
  return [...hoggies, ...crests, ...stickers, ...packs];
}

export function areaOf(item: Item) {
  return item.span[0] * item.span[1];
}

export function usedBy(items: Item[]) {
  return items.reduce((sum, item) => sum + areaOf(item), 0);
}

export function capacityOf(bag: Bag, items: Item[]) {
  return Math.max(bag.capacity, Math.ceil(usedBy(items) / columns) * columns);
}

type Order = Record<string, string[]>;

export type Arranged = Record<string, Item[]>;

export function arrange(bags: Bag[], order: Order, items: Item[]): Arranged {
  const byKey = new Map(items.map((item) => [item.key, item]));
  const placed = new Set<string>();
  const arranged: Arranged = Object.fromEntries(
    bags.map((bag) => {
      const kept = (order[bag.id] ?? []).filter((key) => byKey.has(key) && !placed.has(key));
      kept.forEach((key) => placed.add(key));
      return [bag.id, kept.map((key) => byKey.get(key)!)];
    }),
  );
  for (const item of items) {
    if (placed.has(item.key)) continue;
    const home = arranged[item.home] ?? arranged[bags[0]!.id]!;
    home.push(item);
  }
  return arranged;
}

export type Move = { key: string; to: string; before: string | null };

export function useBags(items: Item[]) {
  const [bags, setBags] = useState(() => starterBags.map((bag) => ({ ...bag, open: bag.open && window.innerWidth >= 760 })));
  const [order, setOrder] = useState<Order>({});
  const [made, setMade] = useState(0);
  const arranged = useMemo(() => arrange(bags, order, items), [bags, order, items]);

  const move = useCallback(
    ({ key, to, before }: Move) => {
      const target = bags.find(({ id }) => id === to);
      const item = items.find((each) => each.key === key);
      if (target === undefined || item === undefined || key === before) return true;
      const already = arranged[to]!.some((each) => each.key === key);
      if (!already && usedBy(arranged[to]!) + areaOf(item) > target.capacity) return false;
      const next: Order = Object.fromEntries(bags.map(({ id }) => [id, arranged[id]!.map((each) => each.key).filter((each) => each !== key)]));
      const list = next[to]!;
      const at = before === null ? -1 : list.indexOf(before);
      list.splice(at < 0 ? list.length : at, 0, key);
      setOrder(next);
      setBags((current) => current.map((bag) => (bag.id === to ? { ...bag, open: true } : bag)));
      return true;
    },
    [bags, items, arranged],
  );

  const toggle = useCallback((id: string) => setBags((current) => current.map((bag) => (bag.id === id ? { ...bag, open: !bag.open } : bag))), []);
  const toggleAll = useCallback(() => setBags((current) => current.map((bag) => ({ ...bag, open: current.some(({ open }) => !open) }))), []);
  const closeAll = useCallback(() => setBags((current) => current.map((bag) => ({ ...bag, open: false }))), []);
  const rename = useCallback((id: string, name: string) => setBags((current) => current.map((bag) => (bag.id === id ? { ...bag, name: name.trim() || bag.name } : bag))), []);
  const add = useCallback(
    (name: string, icon: BagIcon) => {
      setBags((current) => [...current, { id: `bag:${made + 1}`, name: name.trim() || "New bag", icon, open: true, capacity: 16, starter: false }]);
      setMade(made + 1);
    },
    [made],
  );
  const remove = useCallback((id: string) => {
    setBags((current) => current.filter((bag) => bag.id !== id || bag.starter));
    setOrder((current) => Object.fromEntries(Object.entries(current).filter(([bag]) => bag !== id)));
  }, []);

  return { bags, arranged, move, toggle, toggleAll, closeAll, rename, add, remove };
}

export type Bags = ReturnType<typeof useBags>;

export const cell = 38;

export const gap = 4;

const chrome = 58;

export function frameHeight(bag: Bag, items: Item[]) {
  const rows = capacityOf(bag, items) / columns;
  return chrome + rows * cell + (rows - 1) * gap;
}

export function columnsOf(bags: Bag[], arranged: Arranged, budget: number): Bag[][] {
  const stacks: { bags: Bag[]; height: number }[] = [];
  for (const bag of bags.filter(({ open }) => open)) {
    const height = frameHeight(bag, arranged[bag.id]!);
    const last = stacks.at(-1);
    if (last !== undefined && last.height + 10 + height <= budget) {
      last.bags.push(bag);
      last.height += 10 + height;
    } else stacks.push({ bags: [bag], height });
  }
  return stacks.map(({ bags: stack }) => stack);
}

export function stackHeight(stack: Bag[], arranged: Arranged) {
  return stack.reduce((sum, bag, index) => sum + frameHeight(bag, arranged[bag.id]!) + (index > 0 ? 10 : 0), 0);
}
