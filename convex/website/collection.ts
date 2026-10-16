import { crateStoreOf, waitingCratesOf, type CrateStore } from "../hoggies/boughtCrates";
import { collectionOf, type HeldCrest, type HeldHoggie, type RarityShare } from "../hoggies/collection";
import { crateStoreShownTo, crestsShownTo, hoggiesShownTo } from "../hoggies/flag";
import type { QueryCtx } from "../_generated/server";
import { stickersShownTo } from "../stickers/flag";
import { stickersNewestFirst } from "../stickers/records";
import { peopleIn, type MemberId } from "../workspace/directory";
import { bookPageOf } from "./book";
import { teammateOf, type Face } from "./faces";
import { memberQuery, type VerifiedMember } from "./memberQuery";
import { seenKeyOf } from "./seen";
import type { PageWaits } from "./unlockPath";

export type CollectionHoggie = HeldHoggie & { seen: string | null };

export type CollectionCrest = HeldCrest & { seen: string | null };

export type Sticker = { name: string; face: Face; former: boolean; key: string; firstAt: number; seen: string };

export type Stickers = { stickers?: Sticker[] };

export type BoughtCrates = { bought?: string[]; crateStore?: CrateStore | null };

export type CollectionAnswer = { kind: "not-found" } | PageWaits | ({ kind: "collection"; rarities: RarityShare[]; hoggies: CollectionHoggie[]; owned: number; total: number; crests?: CollectionCrest[] } & BoughtCrates & Stickers);

export const getCollection = memberQuery(async (ctx, me): Promise<CollectionAnswer> => {
  if (!(await hoggiesShownTo(ctx, me.member))) return { kind: "not-found" };
  const page = await bookPageOf(ctx, me);
  if (page.kind !== "open") return page;
  const { rarities, hoggies, owned, total, crests } = await collectionOf(ctx, me.member, { crests: await crestsShownTo(ctx, me.member) });
  const collection = { kind: "collection" as const, rarities, hoggies: await Promise.all(hoggies.map((hoggie) => seenBy(me.member, hoggie))), owned, total };
  const withCrests = crests === undefined ? collection : { ...collection, crests: await Promise.all(crests.map((crest) => crestSeenBy(me.member, crest))) };
  return { ...withCrests, ...(await boughtCratesOf(ctx, me.member)), ...(await stickersOf(ctx, me)) };
});

async function stickersOf(ctx: QueryCtx, me: VerifiedMember): Promise<Stickers> {
  if (!(await stickersShownTo(ctx, me.member))) return {};
  const people = await peopleIn(ctx, me.workspace);
  const stickers = await stickersNewestFirst(ctx, me.member);
  return {
    stickers: await Promise.all(
      stickers.map(async ({ person, firstAt }) => {
        const { name, picture, former } = people.get(person) ?? { name: undefined, picture: null, former: true };
        return { ...teammateOf(name, picture), former, key: await seenKeyOf(me.member, `sticker:${person}`), firstAt, seen: await seenKeyOf(me.member, `sticker:${person}:${firstAt}`) };
      }),
    ),
  };
}

async function boughtCratesOf(ctx: QueryCtx, member: MemberId): Promise<BoughtCrates> {
  const storeShown = await crateStoreShownTo(ctx, member);
  const bought = await waitingCratesOf(ctx, member);
  return { ...((storeShown || bought.length > 0) && { bought }), ...(storeShown && { crateStore: await crateStoreOf(ctx, member) }) };
}

async function seenBy(member: MemberId, hoggie: HeldHoggie): Promise<CollectionHoggie> {
  return { ...hoggie, seen: hoggie.firstAt === null ? null : await seenKeyOf(member, `hoggie:${hoggie.hoggie}:${hoggie.firstAt}`) };
}

async function crestSeenBy(member: MemberId, crest: HeldCrest): Promise<CollectionCrest> {
  return { ...crest, seen: crest.collectedAt === null ? null : await seenKeyOf(member, `crest:${crest.crest}:${crest.collectedAt}`) };
}
