import { exposed, memberDecision, memberDecisionWithoutWriting, type Flag } from "../analytics/flags";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const activityNextFlag = { key: "activity-next", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function activityNextShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, activityNextFlag, member);
}

export async function activityNextOnAndExposedFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const on = await memberDecision(ctx, activityNextFlag, member);
  await exposed(ctx, activityNextFlag, member, on);
  return on;
}
