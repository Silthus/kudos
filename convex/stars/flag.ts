import { exposed, memberDecision, type Flag } from "../analytics/flags";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const starsFlag = { key: "stars", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function starsOnFor(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecision(ctx, starsFlag, member);
}

export async function starsOnAndExposedFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const on = await starsOnFor(ctx, member);
  await exposed(ctx, starsFlag, member, on);
  return on;
}
