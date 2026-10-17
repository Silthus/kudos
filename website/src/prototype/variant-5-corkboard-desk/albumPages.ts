// PROTOTYPE (#625): the sticker album's spreads, built from the world: contents, one run of spreads per rarity, one or more per team.
import type { CollectionHoggie, CollectionTeamPage, CollectionTeamPerson } from "../../collectionRead";
import type { Rarity } from "../../shell";
import type { World } from "../world";

export const slotsPerPage = 12;

export const teamSlotsUnderTheHeader = 6;

export type NumberedHoggie = CollectionHoggie & { number: number };

export type NumberedPerson = CollectionTeamPerson & { number: number };

export type AlbumPage =
  | { kind: "welcome" }
  | { kind: "contents" }
  | { kind: "hoggies"; rarity: Rarity; part: number; parts: number; slots: NumberedHoggie[] }
  | { kind: "team-header"; team: CollectionTeamPage; slots: NumberedPerson[] }
  | { kind: "team"; team: CollectionTeamPage; part: number; slots: NumberedPerson[] }
  | { kind: "team-sheet"; team: CollectionTeamPage }
  | { kind: "notes" };

export type Spread = { id: string; label: string; section: string; left: AlbumPage; right: AlbumPage };

const contentsSpread: Spread = { id: "contents", label: "Contents", section: "contents", left: { kind: "welcome" }, right: { kind: "contents" } };

export function spreadsOf(world: World): Spread[] {
  return [contentsSpread, ...hoggieSpreadsOf(world), ...world.teams.flatMap(teamSpreadsOf)];
}

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
}

function hoggieSpreadsOf(world: World): Spread[] {
  const numbered = world.hoggies.map((hoggie, index) => ({ ...hoggie, number: index + 1 }));
  return world.rarities.flatMap(({ rarity }) => {
    const pages = chunks(
      numbered.filter((hoggie) => hoggie.rarity === rarity),
      slotsPerPage,
    );
    const pairs = chunks(pages, 2);
    return pairs.map(([left = [], right], index): Spread => ({
      id: index === 0 ? `hoggies/${rarity}` : `hoggies/${rarity}-${index + 1}`,
      label: rarity,
      section: rarity,
      left: { kind: "hoggies", rarity, part: index * 2 + 1, parts: pages.length, slots: left },
      right: right === undefined ? { kind: "notes" } : { kind: "hoggies", rarity, part: index * 2 + 2, parts: pages.length, slots: right },
    }));
  });
}

function teamSpreadsOf(team: CollectionTeamPage): Spread[] {
  const numbered = team.people.map((person, index) => ({ ...person, number: index + 1 }));
  const underTheHeader = numbered.slice(0, teamSlotsUnderTheHeader);
  const rest = chunks(numbered.slice(teamSlotsUnderTheHeader), slotsPerPage);
  const first: Spread = { id: `teams/${team.team}`, label: team.name, section: "teams", left: { kind: "team-header", team, slots: underTheHeader }, right: rest[0] === undefined ? { kind: "team-sheet", team } : { kind: "team", team, part: 1, slots: rest[0] } };
  const more = chunks(rest.slice(1), 2).map(([left = [], right], index): Spread => ({
    id: `teams/${team.team}-${index + 2}`,
    label: team.name,
    section: "teams",
    left: { kind: "team", team, part: index * 2 + 2, slots: left },
    right: right === undefined ? { kind: "notes" } : { kind: "team", team, part: index * 2 + 3, slots: right },
  }));
  return [first, ...more];
}

export function spreadIndexOf(spreads: Spread[], hash: string) {
  const asked = decodeURIComponent(hash.replace(/^#/, ""));
  const index = spreads.findIndex(({ id }) => id === asked);
  return index === -1 ? 0 : index;
}

export function spreadHoldingHoggie(spreads: Spread[], slug: string) {
  return spreads.find(({ left, right }) => [left, right].some((page) => page.kind === "hoggies" && page.slots.some(({ hoggie }) => hoggie === slug)));
}
