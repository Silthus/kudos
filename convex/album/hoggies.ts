import type { QueryCtx } from "../_generated/server";
import { rarities, type Rarity } from "../hoggies/catalogue";
import { collectionOf, type HeldHoggie } from "../hoggies/collection";
import type { MemberId } from "../workspace/directory";

export const rarestFindsShown = 5;

export type AlbumHoggie = Omit<HeldHoggie, "count"> & { found: boolean; count: number; spares: number };

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
    rarest: rarestFindsIn(hoggies),
  };
}

function albumHoggieOf({ count, ...hoggie }: HeldHoggie): AlbumHoggie {
  return { ...hoggie, found: count > 0, count, spares: Math.max(0, count - 1) };
}

function rarestFindsIn(hoggies: AlbumHoggie[]): AlbumHoggie[] {
  return hoggies
    .filter(({ found }) => found)
    .toSorted((one, other) => rarestFirst.indexOf(one.rarity) - rarestFirst.indexOf(other.rarity) || other.firstAt! - one.firstAt!)
    .slice(0, rarestFindsShown);
}
