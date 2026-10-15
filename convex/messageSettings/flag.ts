import type { MutationCtx, QueryCtx } from "../_generated/server";
import { exposed, memberDecision, type Flag } from "../analytics/flags";
import type { MemberId } from "../workspace/directory";

export const messageSettingsFlag = { key: "message-settings", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export async function messageSettingsShownTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const shown = await messageSettingsOnFor(ctx, member);
  await exposed(ctx, messageSettingsFlag, member, shown);
  return shown;
}

export function messageSettingsOnFor(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return memberDecision(ctx, messageSettingsFlag, member);
}
