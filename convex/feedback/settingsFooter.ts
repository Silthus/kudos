import type { QueryCtx } from "../_generated/server";
import { messageSettingsOnFor } from "../messageSettings/flag";
import type { MemberId } from "../workspace/directory";

export type SettingsFooter = { appHome: string; rest: string };

const settingsFooter: SettingsFooter = { appHome: "Change what I send you", rest: " in App Home's Settings tab." };

export async function settingsFooterFor(ctx: QueryCtx, member: MemberId | null): Promise<SettingsFooter | null> {
  return member !== null && (await messageSettingsOnFor(ctx, member)) ? settingsFooter : null;
}
