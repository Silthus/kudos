import { memberDecisionWithoutWriting, type Flag } from "../analytics/flags";
import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const progressBeatsFlag = { key: "progress-beats", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function progressBeatsShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, progressBeatsFlag, member);
}
