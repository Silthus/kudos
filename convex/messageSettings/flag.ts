import type { MutationCtx } from "../_generated/server";
import { exposed, memberDecision, type Flag } from "../analytics/flags";
import type { MemberId } from "../workspace/directory";

export const messageSettingsFlag = { key: "message-settings", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export async function messageSettingsShownTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const shown = await memberDecision(ctx, messageSettingsFlag, member);
  await exposed(ctx, messageSettingsFlag, member, shown);
  return shown;
}
