import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { exposed, workspaceDecision } from "../analytics/flags";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { unlocksAppliedIn } from "../unlocks/launch";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { questsFlag } from "./questsFlag";

export async function questsApplyIn(ctx: QueryCtx | MutationCtx, workspace: string): Promise<boolean> {
  return (await workspaceDecision(ctx, questsFlag, workspace)) && (await xpLevelsShownIn(ctx, workspace)) && (await unlocksAppliedIn(ctx, workspace));
}

export async function questsShownTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const { workspace } = await chatUserOf(ctx, member);
  return (await questsExposedTo(ctx, member)) && (await questsLiveIn(ctx, workspace));
}

export async function questsExposedTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const { workspace } = await chatUserOf(ctx, member);
  if (!(await xpLevelsShownIn(ctx, workspace)) || !(await unlocksAppliedIn(ctx, workspace))) return false;
  const applies = await workspaceDecision(ctx, questsFlag, workspace);
  await exposed(ctx, questsFlag, member, applies);
  return applies;
}

export async function questsLiveIn(ctx: MutationCtx, workspace: string): Promise<boolean> {
  if (!(await questsApplyIn(ctx, workspace))) return false;
  if ((await journeyLaunchIn(ctx, workspace)) === null) await launchJourney(ctx, workspace);
  return true;
}

export async function journeyShippedAt(ctx: QueryCtx, workspace: string): Promise<number | null> {
  return (await journeyLaunchIn(ctx, workspace))?.at ?? null;
}

async function launchJourney(ctx: MutationCtx, workspace: string) {
  const launch = await ctx.db.insert("journeyLaunches", { workspace, at: Date.now() });
  await ctx.scheduler.runAfter(0, internal.quests.join.joinJourneyPage, { launch });
}

function journeyLaunchIn(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("journeyLaunches")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}
