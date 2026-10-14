import { exposed, memberDecision, type Flag } from "../analytics/flags";
import type { MutationCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const crateRewardsFlag = { key: "crate-rewards", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export async function rewardHeldFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const held = await memberDecision(ctx, crateRewardsFlag, member);
  await exposed(ctx, crateRewardsFlag, member, held);
  return held;
}
