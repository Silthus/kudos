import { memberDecisionWithoutWriting, type Flag } from "../analytics/flags";
import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const hiddenItemsFlag = { key: "hidden-items", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function hiddenItemsShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, hiddenItemsFlag, member);
}
