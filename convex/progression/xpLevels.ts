import type { MutationCtx, QueryCtx } from "../_generated/server";
import { exposed, memberDecision, workspaceDecision, type Flag } from "../analytics/flags";
import type { MemberId } from "../workspace/directory";

export const xpLevels = { key: "xp-levels", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function xpLevelsShownIn(ctx: QueryCtx | MutationCtx, workspace: string): Promise<boolean> {
  return workspaceDecision(ctx, xpLevels, workspace);
}

export function xpLevelsOnFor(ctx: QueryCtx | MutationCtx, member: MemberId): Promise<boolean> {
  return memberDecision(ctx, xpLevels, member);
}

export async function xpLevelsShownTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const shown = await xpLevelsOnFor(ctx, member);
  await exposed(ctx, xpLevels, member, shown);
  return shown;
}
