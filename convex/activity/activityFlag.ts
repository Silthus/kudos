import { memberDecision, type Flag } from "../analytics/flags";
import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const activityFlag = { key: "activity", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function activityShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecision(ctx, activityFlag, member);
}
