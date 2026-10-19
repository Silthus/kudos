import { memberDecisionWithoutWriting, type Flag } from "../analytics/flags";
import { albumShownTo } from "../album/flag";
import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const albumSlackFlag = { key: "album-slack", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export async function albumSlackAppliesTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await albumShownTo(ctx, member)) && (await memberDecisionWithoutWriting(ctx, albumSlackFlag, member));
}
