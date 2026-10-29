import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import type { PageOwner } from "../teamPages";
import { earnedItemOf, earnItem } from "../items/ledger";
import type { MemberId } from "../../workspace/directory";
import { catalogue, hoggieNamed, hoggiesOfRarity, rarityAbove, sparesForged, type CatalogueHoggie } from "./catalogue";
import { talliesOf } from "./collection";
import type { CrateKey } from "./crateKey";
import { pickOf } from "./draw";
import { drawSecret, droppedIn, recordFind, tallyOf } from "./drops";

const requestShape = /^[\w-]{1,64}$/;

export async function forge(ctx: MutationCtx, owner: PageOwner, hoggie: string, request: string, at: number): Promise<Id<"items"> | null> {
  if (!requestShape.test(request)) return null;
  const key: CrateKey = `forge:${request}`;
  return (await earnedItemOf(ctx, owner.member, "hoggie", key))?._id ?? (await forgeAnew(ctx, owner, hoggie, key, at));
}

async function forgeAnew(ctx: MutationCtx, { workspace, member }: PageOwner, hoggie: string, key: CrateKey, at: number): Promise<Id<"items"> | null> {
  const spent = await tallyOf(ctx, member, hoggie);
  if (spent === null || spent.count - 1 < sparesForged || forgedRarityOf(hoggie) === null) return null;
  await ctx.db.patch(spent._id, { count: spent.count - sparesForged });
  return earnItem(ctx, { workspace, member, source: "hoggie", key, reason: { kind: "forge", hoggie }, earnedAt: at });
}

export async function dropForged(ctx: MutationCtx, member: MemberId, crate: CrateKey, from: string, at: number): Promise<void> {
  const rarity = forgedRarityOf(from);
  if (rarity === null || (await droppedIn(ctx, member, crate))) return;
  const forged = await pickOf({ secret: drawSecret(), member, crate, version: catalogue.version, among: await forgeableAmong(ctx, member, hoggiesOfRarity(rarity)) });
  await recordFind(ctx, member, crate, forged, at, { surface: "website" });
}

async function forgeableAmong(ctx: MutationCtx, member: MemberId, ofTheRarity: CatalogueHoggie[]): Promise<CatalogueHoggie[]> {
  const tallies = await talliesOf(ctx, member);
  const unheld = ofTheRarity.filter((entry) => !tallies.has(entry.hoggie));
  return unheld.length > 0 ? unheld : ofTheRarity;
}

function forgedRarityOf(hoggie: string) {
  const rarity = hoggieNamed(hoggie)?.rarity;
  return rarity === undefined ? null : rarityAbove(rarity);
}
