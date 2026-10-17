// PROTOTYPE (#625): the two books' spreads: contents first, then rarity chapters or team pages, each with its own hash. Never merge to main.
import type { CollectionHoggie, CollectionTeamPage, CollectionTeamPerson } from "../../../collectionRead";
import type { Rarity } from "../../../shell";
import { rarityOrder, type World } from "../../world";

export const hoggiesPerPage = 12;

const stickerUnitsPerPage = 16;

export type NumberedHoggie = CollectionHoggie & { number: number };

export type Leaf =
  | { kind: "title" }
  | { kind: "contents" }
  | { kind: "hoggies"; rarity: Rarity; part: number; parts: number; hoggies: NumberedHoggie[] }
  | { kind: "team-cover"; team: CollectionTeamPage }
  | { kind: "stickers"; team: CollectionTeamPage; part: number; people: CollectionTeamPerson[] }
  | { kind: "blank" };

export type Spread = { hash: string; tab: string; left: Leaf; right: Leaf };

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.max(1, Math.ceil(items.length / size)) }, (_, index) => items.slice(index * size, index * size + size));
}

export function hoggieSpreadsOf(world: World): Spread[] {
  const numbered = world.hoggies.map((hoggie, index) => ({ ...hoggie, number: index + 1 }));
  const chapters = rarityOrder.flatMap((rarity) => {
    const pages = chunks(
      numbered.filter((hoggie) => hoggie.rarity === rarity),
      hoggiesPerPage,
    );
    return chunks(pages, 2).map(([left = [], right], index): Spread => ({
      hash: index === 0 ? `#hoggies/${rarity}` : `#hoggies/${rarity}/${index + 1}`,
      tab: rarity,
      left: { kind: "hoggies", rarity, part: index * 2 + 1, parts: pages.length, hoggies: left },
      right: right === undefined ? { kind: "blank" } : { kind: "hoggies", rarity, part: index * 2 + 2, parts: pages.length, hoggies: right },
    }));
  });
  return [{ hash: "#hoggies", tab: "contents", left: { kind: "title" }, right: { kind: "contents" } }, ...chapters];
}

function unitsOf(person: CollectionTeamPerson) {
  return person.lead ? 4 : 1;
}

function pagesOfPeople(people: CollectionTeamPerson[], firstPageUnits: number): CollectionTeamPerson[][] {
  const pages: CollectionTeamPerson[][] = [[]];
  let room = firstPageUnits;
  for (const person of people) {
    if (unitsOf(person) > room) {
      pages.push([]);
      room = stickerUnitsPerPage;
    }
    pages.at(-1)!.push(person);
    room -= unitsOf(person);
  }
  return pages;
}

function leadsFirst(people: CollectionTeamPerson[]) {
  return people.toSorted((first, second) => Number(second.lead) - Number(first.lead));
}

export function teamSpreadsOf(world: World): Spread[] {
  const teams = world.teams.flatMap((team) => {
    const [first = [], ...rest] = pagesOfPeople(leadsFirst(team.people), stickerUnitsPerPage);
    const opening: Spread = { hash: `#teams/${team.team}`, tab: team.team, left: { kind: "team-cover", team }, right: { kind: "stickers", team, part: 1, people: first } };
    const more = chunks(rest, 2)
      .filter((pair) => pair.length > 0)
      .map(([left = [], right], index): Spread => ({
        hash: `#teams/${team.team}/${index + 2}`,
        tab: team.team,
        left: { kind: "stickers", team, part: index * 2 + 2, people: left },
        right: right === undefined ? { kind: "blank" } : { kind: "stickers", team, part: index * 2 + 3, people: right },
      }));
    return [opening, ...more];
  });
  return [{ hash: "#teams", tab: "contents", left: { kind: "title" }, right: { kind: "contents" } }, ...teams];
}

export function spreadIndexAt(spreads: Spread[], hash: string) {
  const exact = spreads.findIndex((spread) => spread.hash === hash);
  return exact === -1 ? 0 : exact;
}

export function hoggieHashOf(world: World, slug: string) {
  return hoggieSpreadsOf(world).find(({ left, right }) => [left, right].some((leaf) => leaf.kind === "hoggies" && leaf.hoggies.some(({ hoggie }) => hoggie === slug)))?.hash ?? "#hoggies";
}

export function firstPageOf(spreads: Spread[], tab: string) {
  return spreads.findIndex((spread) => spread.tab === tab) * 2 + 1;
}
