import { exposed, memberDecision, type Flag } from "../analytics/flags";
import type { MutationCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const starsFlag = { key: "stars", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export async function starsOnAndExposedFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const on = await memberDecision(ctx, starsFlag, member);
  await exposed(ctx, starsFlag, member, on);
  return on;
}
