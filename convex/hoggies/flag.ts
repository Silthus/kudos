import { exposed, memberDecision, type Flag } from "../analytics/flags";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const collectionFlag = { key: "collection", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export const crestsFlag = { key: "crests", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function hoggiesShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecision(ctx, collectionFlag, member);
}

export async function hoggiesDropFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const drops = await memberDecision(ctx, collectionFlag, member);
  await exposed(ctx, collectionFlag, member, drops);
  return drops;
}

export function crestsShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecision(ctx, crestsFlag, member);
}

export async function crestsShownFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const shown = await memberDecision(ctx, crestsFlag, member);
  await exposed(ctx, crestsFlag, member, shown);
  return shown;
}
