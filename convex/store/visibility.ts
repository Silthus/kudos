import type { MutationCtx, QueryCtx } from "../_generated/server";
import { exposed, memberDecision } from "../analytics/flags";
import { openedAtOf } from "../unlocks/unlocks";
import { coinsApplyTo, coinsShownTo } from "../wallet/visibility";
import type { MemberId } from "../workspace/directory";
import { slotsRetiredFlag } from "./slotsRetiredFlag";
import { storeFlag } from "./storeFlag";

export async function storeVisibleTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await openedAtOf(ctx, member, "coins")) !== null && (await storeShownTo(ctx, member));
}

export async function storeVisibleAndExposedTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  if ((await openedAtOf(ctx, member, "coins")) === null || !(await coinsApplyTo(ctx, member))) return false;
  const shown = await memberDecision(ctx, storeFlag, member);
  await exposed(ctx, storeFlag, member, shown);
  return shown;
}

export async function storeShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await coinsApplyTo(ctx, member)) && (await memberDecision(ctx, storeFlag, member));
}

export async function storeShownAndExposedTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  if (!(await coinsShownTo(ctx, member))) return false;
  const shown = await memberDecision(ctx, storeFlag, member);
  await exposed(ctx, storeFlag, member, shown);
  return shown;
}

export async function slotsRetiredFor(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await storeShownTo(ctx, member)) && (await memberDecision(ctx, slotsRetiredFlag, member));
}

export async function slotsRetiredAndExposedFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  if (!(await storeVisibleTo(ctx, member))) return false;
  const retired = await memberDecision(ctx, slotsRetiredFlag, member);
  await exposed(ctx, slotsRetiredFlag, member, retired);
  return retired;
}
