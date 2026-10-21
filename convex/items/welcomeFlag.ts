import { memberDecisionWithoutWriting, type Flag } from "../analytics/flags";
import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { hiddenItemsShownTo } from "./flag";

export const welcomeItemFlag = { key: "welcome-item", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export async function welcomeItemShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await memberDecisionWithoutWriting(ctx, welcomeItemFlag, member)) && (await hiddenItemsShownTo(ctx, member));
}
