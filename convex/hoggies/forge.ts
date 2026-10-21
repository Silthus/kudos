import type { MutationCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { catalogue, hoggieNamed, hoggiesOfRarity, rarityAbove, sparesForged, type CatalogueHoggie } from "./catalogue";
import { talliesOf } from "./collection";
import type { CrateKey } from "./crateKey";
import { pickOf } from "./draw";
import { dropOf, drawSecret, recordFind, tallyOf, type Drop } from "./drops";

const requestShape = /^[\w-]{1,64}$/;

export async function forge(ctx: MutationCtx, member: MemberId, hoggie: string, request: string, at: number): Promise<Drop | null> {
  if (!requestShape.test(request)) return null;
  const crate: CrateKey = `forge:${request}`;
  return (await dropOf(ctx, member, crate)) ?? (await forgeAnew(ctx, member, hoggie, crate, at));
}

async function forgeAnew(ctx: MutationCtx, member: MemberId, hoggie: string, crate: CrateKey, at: number): Promise<Drop | null> {
  const spent = await tallyOf(ctx, member, hoggie);
  const unheld = await unheldAbove(ctx, member, hoggie);
  if (spent === null || spent.count - 1 < sparesForged || unheld.length === 0) return null;
  await ctx.db.patch(spent._id, { count: spent.count - sparesForged });
  await recordFind(ctx, member, crate, await pickOf({ secret: drawSecret(), member, crate, version: catalogue.version, among: unheld }), at, { surface: "website" });
  return dropOf(ctx, member, crate);
}

async function unheldAbove(ctx: MutationCtx, member: MemberId, hoggie: string): Promise<CatalogueHoggie[]> {
  const rarity = hoggieNamed(hoggie)?.rarity;
  const above = rarity === undefined ? null : rarityAbove(rarity);
  if (above === null) return [];
  const tallies = await talliesOf(ctx, member);
  return hoggiesOfRarity(above).filter((entry) => !tallies.has(entry.hoggie));
}
