import type { MutationCtx, QueryCtx } from "../_generated/server";
import { flag, type Flag } from "../analytics/flags";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { unlocksAppliedIn, unlocksLiveIn } from "../unlocks/launch";

export const questsFlag = { key: "quests", subject: "workspace", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean, "workspace">;

export async function questsLiveIn(ctx: MutationCtx, workspace: string): Promise<boolean> {
  return (await questsAndXpLevelsOnIn(ctx, workspace)) && (await unlocksLiveIn(ctx, workspace));
}

export async function questsAppliedIn(ctx: QueryCtx, workspace: string): Promise<boolean> {
  return (await questsAndXpLevelsOnIn(ctx, workspace)) && (await unlocksAppliedIn(ctx, workspace));
}

async function questsAndXpLevelsOnIn(ctx: QueryCtx | MutationCtx, workspace: string) {
  return (await flag(ctx, questsFlag, { workspace })) && (await xpLevelsShownIn(ctx, workspace));
}
