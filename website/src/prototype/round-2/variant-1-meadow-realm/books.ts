// PROTOTYPE (#625): the spreads of the two docked books, Hoggies and Teams, each opening on its contents. Never merge to main.
import type { CollectionHoggie, CollectionTeamPage, CollectionTeamPerson } from "../../../collectionRead";
import type { Rarity } from "../../../shell";
import { rarityOrder, type World } from "../../world";

export type BookId = "hoggies" | "teams";

export type Spread =
  | { kind: "hoggie-contents"; hash: string }
  | { kind: "hoggies"; hash: string; rarity: Rarity; part: number; parts: number; left: CollectionHoggie[]; right: CollectionHoggie[] }
  | { kind: "team-contents"; hash: string }
  | { kind: "team"; hash: string; team: CollectionTeamPage; part: number; parts: number; people: CollectionTeamPerson[] };

export const hoggiesPerPage = 12;

export const peoplePerPage = 20;

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.max(1, Math.ceil(items.length / size)) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

export function bookOf(hash: string): BookId {
  return hash.startsWith("#teams") ? "teams" : "hoggies";
}

export function spreadsOf(book: BookId, world: World): Spread[] {
  return book === "hoggies" ? hoggieSpreadsOf(world) : teamSpreadsOf(world);
}

function hoggieSpreadsOf(world: World): Spread[] {
  const chapters = rarityOrder.flatMap((rarity) => {
    const parts = chunks(
      world.hoggies.filter((hoggie) => hoggie.rarity === rarity),
      hoggiesPerPage * 2,
    );
    return parts.map((hoggies, index): Spread => ({ kind: "hoggies", hash: `#hoggies/${rarity}/${index + 1}`, rarity, part: index + 1, parts: parts.length, left: hoggies.slice(0, hoggiesPerPage), right: hoggies.slice(hoggiesPerPage) }));
  });
  return [{ kind: "hoggie-contents", hash: "#hoggies" }, ...chapters];
}

function teamSpreadsOf(world: World): Spread[] {
  const pages = world.teams.flatMap((team) => {
    const parts = chunks(team.people, peoplePerPage);
    return parts.map((people, index): Spread => ({ kind: "team", hash: index === 0 ? `#teams/${team.team}` : `#teams/${team.team}/${index + 1}`, team, part: index + 1, parts: parts.length, people }));
  });
  return [{ kind: "team-contents", hash: "#teams" }, ...pages];
}

export function spreadIndexAt(spreads: Spread[], hash: string) {
  const exact = spreads.findIndex((spread) => spread.hash === hash);
  if (exact >= 0) return exact;
  const chapter = spreads.findIndex((spread) => spread.hash.startsWith(`${hash}/`));
  return Math.max(0, chapter);
}

export function firstPageOf(spreads: Spread[], index: number) {
  return index * 2 + 1;
}

export function hoggieHash(world: World, slug: string) {
  const spread = hoggieSpreadsOf(world).find((each) => each.kind === "hoggies" && [...each.left, ...each.right].some(({ hoggie }) => hoggie === slug));
  return spread?.hash ?? "#hoggies";
}

export function teamHash(team: string) {
  return `#teams/${team}`;
}
