import { exposed, memberDecision, type Flag } from "../analytics/flags";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { MemberId } from "../workspace/directory";

export const teamPagesFlag = { key: "team-pages", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function teamPagesShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecision(ctx, teamPagesFlag, member);
}

export async function teamPagesApplyTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const applies = await memberDecision(ctx, teamPagesFlag, member);
  await exposed(ctx, teamPagesFlag, member, applies);
  return applies;
}
