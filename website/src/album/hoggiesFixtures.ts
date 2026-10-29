import { catalogue, rarities, type CatalogueHoggie } from "../../../convex/album/hoggies/catalogue";
import type { AlbumHoggie, AlbumHoggies, HoggiesRead, HoggiesShown } from "./answer";

const hour = 3_600_000;

const now = Date.parse("2026-10-18T10:00:00Z");

const rarestFirst = rarities.map(({ rarity }) => rarity).toReversed();

type Copies = (hoggie: CatalogueHoggie, index: number) => number;

type FirstFound = (hoggie: CatalogueHoggie, index: number) => number;

const foundHourly: FirstFound = (_, index) => now - index * hour;

function hoggiesHeld(copiesOf: Copies, firstFound: FirstFound = foundHourly): AlbumHoggies {
  const hoggies = catalogue.hoggies.map((hoggie, index): AlbumHoggie => {
    const count = copiesOf(hoggie, index);
    return { ...hoggie, art: { kind: "hoggie", slug: hoggie.hoggie }, count, firstAt: count > 0 ? firstFound(hoggie, index) : null, found: count > 0, spares: Math.max(0, count - 1) };
  });
  const found = hoggies.filter((hoggie) => hoggie.found);
  return {
    kind: "hoggies",
    hoggies,
    rarities: rarities.map(({ rarity, weight }) => ({ rarity, chance: weight, found: found.filter((hoggie) => hoggie.rarity === rarity).length, total: hoggies.filter((hoggie) => hoggie.rarity === rarity).length })),
    found: found.length,
    total: hoggies.length,
    rarest: found.toSorted((one, other) => rarestFirst.indexOf(one.rarity) - rarestFirst.indexOf(other.rarity) || other.firstAt! - one.firstAt!).slice(0, 5),
  };
}

const midwayCopies: Copies = ({ rarity }, index) => {
  if (rarity === "legendary") return index % 2 === 0 ? 1 : 0;
  if (index % 3 !== 0) return 0;
  return index % 9 === 0 ? 3 : 1;
};

const day = 24 * hour;

const glanceFinds: Record<string, number> = { angel: now - 3 * day, "art-thief": now - 5 * day, "burning-money": now - 8 * day };

const glanceCommons = new Set(catalogue.hoggies.filter(({ rarity }) => rarity === "common").slice(0, 15).map(({ hoggie }) => hoggie));

const glanceCopies: Copies = ({ hoggie }) => (hoggie in glanceFinds || glanceCommons.has(hoggie) ? 1 : 0);

const glanceFirstFound: FirstFound = ({ hoggie }) => glanceFinds[hoggie] ?? now - 20 * day;

export const hoggiesFixtures = {
  midway: hoggiesHeld(midwayCopies),
  glance: hoggiesHeld(glanceCopies, glanceFirstFound),
  newcomer: hoggiesHeld(() => 0),
  everyOne: hoggiesHeld(() => 2),
} satisfies Record<string, AlbumHoggies>;

export function fixedHoggies(answer: HoggiesShown): HoggiesRead {
  return (asking) => (asking ? answer : undefined);
}
