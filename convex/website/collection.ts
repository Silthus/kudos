import { collectionOf, type HeldHoggie, type RarityShare } from "../hoggies/collection";
import { hoggiesShownTo } from "../hoggies/flag";
import type { MemberId } from "../workspace/directory";
import { bookPageOf } from "./book";
import { memberQuery } from "./memberQuery";
import { seenKeyOf } from "./seen";
import type { PageWaits } from "./unlockPath";

export type CollectionHoggie = HeldHoggie & { seen: string | null };

export type CollectionAnswer = { kind: "not-found" } | PageWaits | { kind: "collection"; rarities: RarityShare[]; hoggies: CollectionHoggie[]; owned: number; total: number };

export const getCollection = memberQuery(async (ctx, me): Promise<CollectionAnswer> => {
  if (!(await hoggiesShownTo(ctx, me.member))) return { kind: "not-found" };
  const page = await bookPageOf(ctx, me);
  if (page.kind !== "open") return page;
  const { rarities, hoggies, owned, total } = await collectionOf(ctx, me.member);
  return { kind: "collection", rarities, hoggies: await Promise.all(hoggies.map((hoggie) => seenBy(me.member, hoggie))), owned, total };
});

async function seenBy(member: MemberId, hoggie: HeldHoggie): Promise<CollectionHoggie> {
  return { ...hoggie, seen: hoggie.firstAt === null ? null : await seenKeyOf(member, `hoggie:${hoggie.hoggie}:${hoggie.firstAt}`) };
}
