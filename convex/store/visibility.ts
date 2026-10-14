import type { MutationCtx, QueryCtx } from "../_generated/server";
import { exposed, memberDecision } from "../analytics/flags";
import { openedAtOf } from "../unlocks/unlocks";
import { coinsApplyTo, coinsShownTo } from "../wallet/visibility";
import type { MemberId } from "../workspace/directory";
import { storeFlag } from "./storeFlag";

export async function storeVisibleTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await openedAtOf(ctx, member, "coins")) !== null && (await storeShownTo(ctx, member));
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
