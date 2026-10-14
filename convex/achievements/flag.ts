import type { MutationCtx, QueryCtx } from "../_generated/server";
import { exposed, workspaceDecision } from "../analytics/flags";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { unlocksAppliedIn } from "../unlocks/launch";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { achievementsFlag } from "./achievementsFlag";
import { replayWhatIsNew } from "./replay";

export async function achievementsApplyIn(ctx: QueryCtx | MutationCtx, workspace: string): Promise<boolean> {
  return (await workspaceDecision(ctx, achievementsFlag, workspace)) && (await xpLevelsShownIn(ctx, workspace)) && (await unlocksAppliedIn(ctx, workspace));
}

export async function achievementsLiveIn(ctx: MutationCtx, workspace: string): Promise<boolean> {
  if (!(await achievementsApplyIn(ctx, workspace))) return false;
  if ((await bookLaunchIn(ctx, workspace)) === null) await ctx.db.insert("bookLaunches", { workspace, at: Date.now() });
  await replayWhatIsNew(ctx, workspace);
  return true;
}

export async function bookLaunchDueIn(ctx: QueryCtx, workspace: string): Promise<boolean> {
  return (await achievementsApplyIn(ctx, workspace)) && (await bookLaunchIn(ctx, workspace)) === null;
}

export async function bookLaunchedAt(ctx: QueryCtx, workspace: string): Promise<number | null> {
  return (await bookLaunchIn(ctx, workspace))?.at ?? null;
}

function bookLaunchIn(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("bookLaunches")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}

export async function achievementsShownTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const { workspace } = await chatUserOf(ctx, member);
  if (!(await xpLevelsShownIn(ctx, workspace)) || !(await unlocksAppliedIn(ctx, workspace))) return false;
  const live = await achievementsLiveIn(ctx, workspace);
  await exposed(ctx, achievementsFlag, member, live);
  return live;
}
