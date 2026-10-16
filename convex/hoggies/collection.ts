import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { catalogue, rarities, type CatalogueHoggie, type Rarity } from "./catalogue";
import { dropsNewestFirst, fromTheNewestDrop, type Drop, type HoggieArt } from "./drops";

export type HeldHoggie = CatalogueHoggie & { art: HoggieArt; count: number; firstAt: number | null };

export type RarityShare = { rarity: Rarity; chance: number; owned: number; total: number };

export type Collection = { rarities: RarityShare[]; hoggies: HeldHoggie[]; owned: number; total: number };

export type HoggiesHome = { owned: number; total: number; lastFound: Drop | null };

export async function collectionOf(ctx: QueryCtx, member: MemberId): Promise<Collection> {
  const tallies = await talliesOf(ctx, member);
  const hoggies = catalogue.hoggies.map((entry) => heldOf(entry, tallies.get(entry.hoggie)));
  const held = hoggies.filter(({ count }) => count > 0);
  const shares = rarities.map(({ rarity, weight }) => ({ rarity, chance: weight, owned: countOf(held, rarity), total: countOf(hoggies, rarity) }));
  return { rarities: shares, hoggies, owned: held.length, total: hoggies.length };
}

export async function hoggiesOf(ctx: QueryCtx, member: MemberId): Promise<HoggiesHome> {
  const tallies = await talliesOf(ctx, member);
  const owned = catalogue.hoggies.filter(({ hoggie }) => tallies.has(hoggie)).length;
  return { owned, total: catalogue.hoggies.length, lastFound: await lastFoundBy(ctx, member) };
}

async function talliesOf(ctx: QueryCtx, member: MemberId): Promise<Map<string, Doc<"hoggieTallies">>> {
  const tallies = await ctx.db
    .query("hoggieTallies")
    .withIndex("by_member_hoggie", (q) => q.eq("member", member))
    .take(catalogue.hoggies.length);
  return new Map(tallies.map((tally) => [tally.hoggie, tally]));
}

async function lastFoundBy(ctx: QueryCtx, member: MemberId): Promise<Drop | null> {
  for await (const { drop } of dropsNewestFirst(ctx, member, fromTheNewestDrop)) return drop;
  return null;
}

function heldOf({ hoggie, name, rarity }: CatalogueHoggie, tally: Doc<"hoggieTallies"> | undefined): HeldHoggie {
  return { hoggie, name, rarity, art: { kind: "hoggie", slug: hoggie }, count: tally?.count ?? 0, firstAt: tally?.firstAt ?? null };
}

function countOf(hoggies: HeldHoggie[], rarity: Rarity) {
  return hoggies.filter((entry) => entry.rarity === rarity).length;
}
