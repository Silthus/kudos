import type { QueryCtx } from "../_generated/server";
import { onTheMondayPath } from "../quests/flag";
import type { MemberId } from "../workspace/directory";
import { skillTreeAppliesIn } from "./skillTree";
import { xpLevelsOnFor, xpLevelsShownIn } from "./xpLevels";

export function xpGainsShownTo(ctx: QueryCtx, workspace: string, member: MemberId | null): Promise<boolean> {
  return member === null ? xpLevelsShownIn(ctx, workspace) : xpLevelsOnFor(ctx, member);
}

export async function questGainsShownTo(ctx: QueryCtx, member: MemberId | null): Promise<boolean> {
  return member !== null && (await onTheMondayPath(ctx, member));
}

export async function bonusGainsShownTo(ctx: QueryCtx, workspace: string, member: MemberId | null): Promise<boolean> {
  return (await xpGainsShownTo(ctx, workspace, member)) && (await skillTreeAppliesIn(ctx, workspace));
}
