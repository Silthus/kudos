// PROTOTYPE (#625): the Tome's spreads: rarity chapters of hoggies, then one spread per team page, each with a hash. Never merge to main.
import type { CollectionHoggie, CollectionTeamPage, CollectionTeamPerson } from "../../collectionRead";
import type { Rarity } from "../../shell";
import { rarityOrder, type World } from "../world";

export const hoggiesPerPage = 16;

export const peoplePerPage = 30;

export type HoggieSpread = { kind: "hoggies"; hash: string; chapter: Rarity; number: number; of: number; pages: [CollectionHoggie[], CollectionHoggie[]] };

export type TeamSpread = { kind: "team"; hash: string; chapter: "teams"; team: CollectionTeamPage; people: CollectionTeamPerson[]; number: number; of: number };

export type Spread = HoggieSpread | TeamSpread;

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.max(1, Math.ceil(items.length / size)) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

export function spreadsOf(world: World): Spread[] {
  const hoggieSpreads = rarityOrder.flatMap((rarity) => {
    const spreads = chunks(
      world.hoggies.filter((hoggie) => hoggie.rarity === rarity),
      hoggiesPerPage * 2,
    );
    return spreads.map((hoggies, index): HoggieSpread => ({ kind: "hoggies", hash: `#hoggies/${rarity}/${index + 1}`, chapter: rarity, number: index + 1, of: spreads.length, pages: [hoggies.slice(0, hoggiesPerPage), hoggies.slice(hoggiesPerPage)] }));
  });
  const teamSpreads = world.teams.flatMap((team) => {
    const spreads = chunks(team.people, peoplePerPage);
    return spreads.map((people, index): TeamSpread => ({ kind: "team", hash: index === 0 ? `#teams/${team.team}` : `#teams/${team.team}/${index + 1}`, chapter: "teams", team, people, number: index + 1, of: spreads.length }));
  });
  return [...hoggieSpreads, ...teamSpreads];
}

export function spreadIndexAt(spreads: Spread[], hash: string) {
  const exact = spreads.findIndex((spread) => spread.hash === hash);
  if (exact >= 0) return exact;
  const chapterStart = spreads.findIndex((spread) => spread.hash.startsWith(`${hash}/`));
  return Math.max(0, chapterStart);
}

export function tomeHrefOfHoggie(world: World, slug: string) {
  const spread = spreadsOf(world).find((each) => each.kind === "hoggies" && each.pages.some((page) => page.some(({ hoggie }) => hoggie === slug)));
  return `/book${spread?.hash ?? ""}`;
}
