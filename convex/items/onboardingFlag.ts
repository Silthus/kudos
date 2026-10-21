import { memberDecisionWithoutWriting, type Flag } from "../analytics/flags";
import type { QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";
import { hiddenItemsShownTo } from "./flag";

export const onboardingFlag = { key: "onboarding", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export async function onboardingShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await memberDecisionWithoutWriting(ctx, onboardingFlag, member)) && (await hiddenItemsShownTo(ctx, member));
}
