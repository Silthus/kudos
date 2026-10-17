// PROTOTYPE (#625) round 2 variant 4: the two books' spreads, each with its hash, from index page to last page. Never merge to main.
import type { CollectionHoggie, CollectionTeamPage, CollectionTeamPerson } from "../../../collectionRead";
import type { Rarity } from "../../../shell";
import { rarityOrder, type World } from "../../world";
import type { BookId } from "./address";

export const hoggiesPerPage = 12;

export const peoplePerPage = 12;

export type Page =
  | { kind: "title"; book: BookId }
  | { kind: "contents"; book: BookId }
  | { kind: "hoggies"; rarity: Rarity; part: number; parts: number; hoggies: CollectionHoggie[] }
  | { kind: "team-cover"; team: CollectionTeamPage }
  | { kind: "team-people"; team: CollectionTeamPage; part: number; parts: number; people: CollectionTeamPerson[] }
  | { kind: "chapter-end"; label: string };

export type Spread = { hash: string; chapter: string; left: Page; right: Page };

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.max(1, Math.ceil(items.length / size)) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function paired(pages: Page[], label: string): [Page, Page][] {
  return chunks(pages, 2).map(([left, right]) => [left!, right ?? { kind: "chapter-end", label }]);
}

export function hoggieSpreadsOf(world: World): Spread[] {
  const index: Spread = { hash: "#hoggies", chapter: "index", left: { kind: "title", book: "hoggies" }, right: { kind: "contents", book: "hoggies" } };
  const chapters = rarityOrder.flatMap((rarity) => {
    const parts = chunks(
      world.hoggies.filter((hoggie) => hoggie.rarity === rarity),
      hoggiesPerPage,
    );
    const pages = parts.map((hoggies, part): Page => ({ kind: "hoggies", rarity, part: part + 1, parts: parts.length, hoggies }));
    return paired(pages, `End of the ${rarity} hoggies`).map(([left, right], spread): Spread => ({ hash: `#hoggies/${rarity}/${spread + 1}`, chapter: rarity, left, right }));
  });
  return [index, ...chapters];
}

export function teamSpreadsOf(world: World): Spread[] {
  const index: Spread = { hash: "#teams", chapter: "index", left: { kind: "title", book: "teams" }, right: { kind: "contents", book: "teams" } };
  const chapters = world.teams.flatMap((team) => {
    const parts = chunks(team.people, peoplePerPage);
    const pages: Page[] = [{ kind: "team-cover", team }, ...parts.map((people, part): Page => ({ kind: "team-people", team, part: part + 1, parts: parts.length, people }))];
    return paired(pages, `End of ${team.name}`).map(([left, right], spread): Spread => ({ hash: spread === 0 ? `#teams/${team.team}` : `#teams/${team.team}/${spread + 1}`, chapter: team.team, left, right }));
  });
  return [index, ...chapters];
}

export function spreadsOf(book: BookId, world: World) {
  return book === "hoggies" ? hoggieSpreadsOf(world) : teamSpreadsOf(world);
}

export function spreadIndexAt(spreads: Spread[], hash: string) {
  const exact = spreads.findIndex((spread) => spread.hash === hash);
  if (exact >= 0) return exact;
  const chapterStart = spreads.findIndex((spread) => spread.hash.startsWith(`${hash}/`));
  return Math.max(0, chapterStart);
}

export function pageNumberOf(spreads: Spread[], hash: string) {
  return spreadIndexAt(spreads, hash) * 2 + 1;
}

export function hoggieHashOf(world: World, slug: string) {
  const spread = hoggieSpreadsOf(world).find(({ left, right }) => [left, right].some((page) => page.kind === "hoggies" && page.hoggies.some(({ hoggie }) => hoggie === slug)));
  return spread?.hash ?? "#hoggies";
}
