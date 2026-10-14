import type { QueryCtx } from "../_generated/server";
import { questsApplyIn, questsApplyTo } from "../quests/flag";
import type { MemberId } from "../workspace/directory";
import { skillTreeAppliesIn } from "./skillTree";
import { xpLevelsOnFor, xpLevelsShownIn } from "./xpLevels";

export function xpGainsShownTo(ctx: QueryCtx, workspace: string, member: MemberId | null): Promise<boolean> {
  return member === null ? xpLevelsShownIn(ctx, workspace) : xpLevelsOnFor(ctx, member);
}

export function questGainsShownTo(ctx: QueryCtx, workspace: string, member: MemberId | null): Promise<boolean> {
  return member === null ? questsApplyIn(ctx, workspace) : questsApplyTo(ctx, member);
}

export async function bonusGainsShownTo(ctx: QueryCtx, workspace: string, member: MemberId | null): Promise<boolean> {
  return (await xpGainsShownTo(ctx, workspace, member)) && (await skillTreeAppliesIn(ctx, workspace));
}
