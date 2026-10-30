import { exposed, memberDecision, memberDecisionWithoutWriting, type Flag } from "../analytics/flags";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const hugsFlag = { key: "hugs", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export async function hugsOnAndExposedFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const on = await memberDecision(ctx, hugsFlag, member);
  await exposed(ctx, hugsFlag, member, on);
  return on;
}

export const hugRewardsFlag = { key: "hug-rewards", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export async function hugRewardsOnAndExposedFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const on = await memberDecision(ctx, hugRewardsFlag, member);
  await exposed(ctx, hugRewardsFlag, member, on);
  return on;
}

export function hugRewardsShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, hugRewardsFlag, member);
}

export function hugsShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecision(ctx, hugsFlag, member);
}
