import { collectionOf, type HeldCrest, type HeldHoggie, type RarityShare } from "../hoggies/collection";
import { crestsShownTo, hoggiesShownTo } from "../hoggies/flag";
import type { MemberId } from "../workspace/directory";
import { bookPageOf } from "./book";
import { memberQuery } from "./memberQuery";
import { seenKeyOf } from "./seen";
import type { PageWaits } from "./unlockPath";

export type CollectionHoggie = HeldHoggie & { seen: string | null };

export type CollectionCrest = HeldCrest & { seen: string | null };

export type CollectionAnswer = { kind: "not-found" } | PageWaits | { kind: "collection"; rarities: RarityShare[]; hoggies: CollectionHoggie[]; owned: number; total: number; crests?: CollectionCrest[] };

export const getCollection = memberQuery(async (ctx, me): Promise<CollectionAnswer> => {
  if (!(await hoggiesShownTo(ctx, me.member))) return { kind: "not-found" };
  const page = await bookPageOf(ctx, me);
  if (page.kind !== "open") return page;
  const { rarities, hoggies, owned, total, crests } = await collectionOf(ctx, me.member, { crests: await crestsShownTo(ctx, me.member) });
  const collection = { kind: "collection" as const, rarities, hoggies: await Promise.all(hoggies.map((hoggie) => seenBy(me.member, hoggie))), owned, total };
  return crests === undefined ? collection : { ...collection, crests: await Promise.all(crests.map((crest) => crestSeenBy(me.member, crest))) };
});

async function seenBy(member: MemberId, hoggie: HeldHoggie): Promise<CollectionHoggie> {
  return { ...hoggie, seen: hoggie.firstAt === null ? null : await seenKeyOf(member, `hoggie:${hoggie.hoggie}:${hoggie.firstAt}`) };
}

async function crestSeenBy(member: MemberId, crest: HeldCrest): Promise<CollectionCrest> {
  return { ...crest, seen: crest.collectedAt === null ? null : await seenKeyOf(member, `crest:${crest.crest}:${crest.collectedAt}`) };
}
