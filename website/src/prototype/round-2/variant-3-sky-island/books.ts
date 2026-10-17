// PROTOTYPE (#625): the two books' pages, each with its own hash: Hoggies (index, rarity pages) and Teams (index, team pages). Never merge to main.
import type { CollectionHoggie, CollectionTeamPage, CollectionTeamPerson } from "../../../collectionRead";
import type { Rarity } from "../../../shell";
import { rarityOrder, type World } from "../../world";

export type BookId = "hoggies" | "teams";

export type IndexPage = { kind: "index"; book: BookId; hash: string; chapter: "index" };

export type HoggiePage = { kind: "hoggies"; hash: string; chapter: Rarity; part: number; parts: number; hoggies: CollectionHoggie[] };

export type TeamPage = { kind: "team"; hash: string; chapter: string; team: CollectionTeamPage; part: number; parts: number; people: CollectionTeamPerson[] };

export type BookPage = IndexPage | HoggiePage | TeamPage;

const hoggiesPerPage = 20;

const peoplePerPage = 12;

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.max(1, Math.ceil(items.length / size)) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

export function pagesOf(book: BookId, world: World): BookPage[] {
  const index: IndexPage = { kind: "index", book, hash: `#${book}`, chapter: "index" };
  return book === "hoggies" ? [index, ...hoggiePagesOf(world)] : [index, ...teamPagesOf(world)];
}

function hoggiePagesOf(world: World): HoggiePage[] {
  return rarityOrder.flatMap((rarity) => {
    const parts = chunks(
      world.hoggies.filter((hoggie) => hoggie.rarity === rarity),
      hoggiesPerPage,
    );
    return parts.map((hoggies, index): HoggiePage => ({ kind: "hoggies", hash: `#hoggies/${rarity}/${index + 1}`, chapter: rarity, part: index + 1, parts: parts.length, hoggies }));
  });
}

function teamPagesOf(world: World): TeamPage[] {
  return world.teams.flatMap((team) => {
    const parts = chunks(team.people, peoplePerPage);
    return parts.map((people, index): TeamPage => ({ kind: "team", hash: index === 0 ? `#teams/${team.team}` : `#teams/${team.team}/${index + 1}`, chapter: team.team, team, part: index + 1, parts: parts.length, people }));
  });
}

export function bookOfHash(hash: string): BookId | null {
  if (hash === "#hoggies" || hash.startsWith("#hoggies/")) return "hoggies";
  if (hash === "#teams" || hash.startsWith("#teams/")) return "teams";
  return null;
}

export function pageIndexAt(pages: BookPage[], hash: string) {
  const exact = pages.findIndex((page) => page.hash === hash);
  if (exact >= 0) return exact;
  const chapterStart = pages.findIndex((page) => page.hash.startsWith(`${hash}/`));
  return Math.max(0, chapterStart);
}

export function hashOfHoggie(world: World, slug: string) {
  return pagesOf("hoggies", world).find((page) => page.kind === "hoggies" && page.hoggies.some(({ hoggie }) => hoggie === slug))?.hash ?? "#hoggies";
}

export function hashOfPerson(world: World, team: string, key: string) {
  return pagesOf("teams", world).find((page) => page.kind === "team" && page.team.team === team && page.people.some((person) => person.key === key))?.hash ?? `#teams/${team}`;
}
