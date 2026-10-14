import type { MutationCtx, QueryCtx } from "../_generated/server";
import { exposed, workspaceDecision, type Flag } from "../analytics/flags";
import { chatUserOf, type MemberId } from "../workspace/directory";

export const xpLevels = { key: "xp-levels", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function xpLevelsShownIn(ctx: QueryCtx | MutationCtx, workspace: string): Promise<boolean> {
  return workspaceDecision(ctx, xpLevels, workspace);
}

export async function xpLevelsShownTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const { workspace } = await chatUserOf(ctx, member);
  const shown = await xpLevelsShownIn(ctx, workspace);
  await exposed(ctx, xpLevels, member, shown);
  return shown;
}
