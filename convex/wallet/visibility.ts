import type { MutationCtx, QueryCtx } from "../_generated/server";
import { exposed, memberDecision } from "../analytics/flags";
import { unlockPathShownTo } from "../unlocks/launch";
import { stateOf } from "../unlocks/unlocks";
import type { MemberId } from "../workspace/directory";
import { coinsFlag } from "./coinsFlag";

export async function coinsVisibleTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await coinsApplyTo(ctx, member)) && (await isCoinsOpenFor(ctx, member));
}

export async function coinsVisibleAndExposedTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  return (await coinsShownTo(ctx, member)) && (await isCoinsOpenFor(ctx, member));
}

export async function coinsShownTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  if (!(await unlockPathShownTo(ctx, member))) return false;
  const shown = await memberDecision(ctx, coinsFlag, member);
  await exposed(ctx, coinsFlag, member, shown);
  return shown;
}

async function coinsApplyTo(ctx: QueryCtx, member: MemberId) {
  return (await unlockPathShownTo(ctx, member)) && (await memberDecision(ctx, coinsFlag, member));
}

async function isCoinsOpenFor(ctx: QueryCtx, member: MemberId) {
  return (await stateOf(ctx, member, "coins")) === "open";
}
