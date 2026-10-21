import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { recordMilestonesOf } from "../album/milestones";
import { tallyHoggieFound } from "../album/tallies";
import type { PageOwner } from "../album/teamPages";
import { publish } from "../bus/publish";
import type { CrateKey } from "../hoggies/crateKey";
import { dropFor, dropOf, foundIn, packOf, type Drop } from "../hoggies/drops";
import { crestsShownTo } from "../hoggies/flag";
import type { AppliedReward } from "../progression/rewards";

export type TurnedFace = { kind: "hoggie"; drop: Drop };

export type LandingPage = { kind: "hoggies" };

export type Turned = { face: TurnedFace; applied: AppliedReward | null; page: LandingPage; again: boolean };

export async function turn(ctx: MutationCtx, owner: PageOwner, item: Id<"items">, at: number): Promise<Turned | null> {
  const row = await ctx.db.get(item);
  if (row?.member !== owner.member) return null;
  if (row.turnedAt !== undefined) return turnedAgain(ctx, row);
  const crate = row.key as CrateKey;
  await dropFor(ctx, owner.member, crate, at, { surface: "website", floor: row.floor });
  const drop = await dropOf(ctx, owner.member, crate);
  if (drop === null) return null;
  await tallyHoggieFound(ctx, owner.member, { hoggie: drop.hoggie, rarity: drop.rarity }, at);
  await recordMilestonesOf(ctx, owner, at);
  await ctx.db.patch(row._id, { turnedAt: at });
  await publish(ctx, { type: "itemTurned", workspace: owner.workspace, member: owner.member, source: "hoggie", rarity: drop.rarity, isNew: drop.isNew, at });
  return { face: { kind: "hoggie", drop }, applied: await packOf(ctx, owner.member, crate), page: { kind: "hoggies" }, again: false };
}

async function turnedAgain(ctx: MutationCtx, row: Doc<"items">): Promise<Turned | null> {
  const drop = await foundIn(ctx, row.member, row.key as CrateKey, { crests: await crestsShownTo(ctx, row.member) });
  return drop === null ? null : { face: { kind: "hoggie", drop }, applied: null, page: { kind: "hoggies" }, again: true };
}
