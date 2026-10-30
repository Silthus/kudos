import { memberDecisionWithoutWriting, type Flag } from "../../analytics/flags";
import type { QueryCtx } from "../../_generated/server";
import type { MemberId } from "../../workspace/directory";
import { hiddenItemsShownTo } from "./flag";
import type { ItemReason } from "./records";

export const achievementHoggiesFlag = { key: "achievement-hoggies", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export async function achievementHoggiesShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await memberDecisionWithoutWriting(ctx, achievementHoggiesFlag, member)) && (await hiddenItemsShownTo(ctx, member));
}

export function isAnAchievement(reason: ItemReason): boolean {
  return reason.kind === "team" || reason.kind === "milestone";
}
