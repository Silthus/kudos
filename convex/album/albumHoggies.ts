import type { QueryCtx } from "../_generated/server";
import { rarities, type Rarity } from "./hoggies/catalogue";
import { collectionOf, type HeldHoggie } from "./hoggies/collection";
import type { MemberId } from "../workspace/directory";

export const rarestFindsShown = 5;

export type AlbumHoggie = HeldHoggie & { found: boolean; spares: number };

export type AlbumRarity = { rarity: Rarity; chance: number; found: number; total: number };

export type AlbumHoggies = { hoggies: AlbumHoggie[]; rarities: AlbumRarity[]; found: number; total: number; rarest: AlbumHoggie[] };

const rarestFirst = rarities.map(({ rarity }) => rarity).toReversed();

export async function albumHoggiesOf(ctx: QueryCtx, member: MemberId): Promise<AlbumHoggies> {
  const collection = await collectionOf(ctx, member, { crests: false });
  const hoggies = collection.hoggies.map(albumHoggieOf);
  return {
    hoggies,
    rarities: collection.rarities.map(({ rarity, chance, owned, total }) => ({ rarity, chance, found: owned, total })),
    found: collection.owned,
    total: collection.total,
    rarest: rarestFindsIn(hoggies, rarestFindsShown),
  };
}

function albumHoggieOf(hoggie: HeldHoggie): AlbumHoggie {
  return { ...hoggie, found: hoggie.count > 0, spares: Math.max(0, hoggie.count - 1) };
}

export function rarestFindsIn<Found extends Pick<AlbumHoggie, "found" | "firstAt" | "rarity">>(hoggies: Found[], most: number): Array<Found & { firstAt: number }> {
  return hoggies
    .filter((hoggie): hoggie is Found & { firstAt: number } => hoggie.found && hoggie.firstAt !== null)
    .toSorted((one, other) => rarestFirst.indexOf(one.rarity) - rarestFirst.indexOf(other.rarity) || other.firstAt - one.firstAt)
    .slice(0, most);
}
