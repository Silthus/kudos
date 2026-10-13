import type { MutationCtx, QueryCtx } from "../_generated/server";
import { flag } from "../analytics/flags";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { unlocksAppliedIn } from "../unlocks/launch";
import { questsFlag } from "./questsFlag";

export async function questsApplyIn(ctx: QueryCtx | MutationCtx, workspace: string): Promise<boolean> {
  return (await flag(ctx, questsFlag, { workspace })) && (await xpLevelsShownIn(ctx, workspace)) && (await unlocksAppliedIn(ctx, workspace));
}
