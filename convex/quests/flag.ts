import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { exposed, memberDecision, workspaceDecision } from "../analytics/flags";
import { xpLevelsOnFor, xpLevelsShownIn } from "../progression/xpLevels";
import { unlocksAppliedIn, unlocksAppliedTo } from "../unlocks/launch";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { joinMember } from "./join";
import { questsFlag } from "./questsFlag";

export async function questsApplyIn(ctx: QueryCtx | MutationCtx, workspace: string): Promise<boolean> {
  return (await workspaceDecision(ctx, questsFlag, workspace)) && (await xpLevelsShownIn(ctx, workspace)) && (await unlocksAppliedIn(ctx, workspace));
}

export async function questsApplyTo(ctx: QueryCtx | MutationCtx, member: MemberId): Promise<boolean> {
  return (await memberDecision(ctx, questsFlag, member)) && (await questsDecideFor(ctx, member));
}

export async function questsShownTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  return (await questsExposedTo(ctx, member)) && (await questsLiveFor(ctx, member));
}

export async function questsExposedTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  if (!(await questsDecideFor(ctx, member))) return false;
  const applies = await memberDecision(ctx, questsFlag, member);
  await exposed(ctx, questsFlag, member, applies);
  return applies;
}

export async function questsLiveFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const { workspace } = await chatUserOf(ctx, member);
  await questsLiveIn(ctx, workspace);
  if (!(await questsApplyTo(ctx, member))) return false;
  if ((await journeyLaunchIn(ctx, workspace)) === null) await previewOnce(ctx, workspace, member);
  return true;
}

export async function questsLiveIn(ctx: MutationCtx, workspace: string): Promise<boolean> {
  if (!(await questsApplyIn(ctx, workspace))) return false;
  if ((await journeyLaunchIn(ctx, workspace)) === null) await launchJourney(ctx, workspace);
  return true;
}

export async function journeyShippedAt(ctx: QueryCtx, workspace: string): Promise<number | null> {
  return (await journeyLaunchIn(ctx, workspace))?.at ?? null;
}

export async function journeyStartedFor(ctx: QueryCtx, member: MemberId): Promise<number | null> {
  const { workspace } = await chatUserOf(ctx, member);
  return (await journeyShippedAt(ctx, workspace)) ?? (await previewMomentOf(ctx, member))?.at ?? null;
}

async function questsDecideFor(ctx: QueryCtx | MutationCtx, member: MemberId) {
  return (await xpLevelsOnFor(ctx, member)) && (await unlocksAppliedTo(ctx, member));
}

async function launchJourney(ctx: MutationCtx, workspace: string) {
  const launch = await ctx.db.insert("journeyLaunches", { workspace, at: Date.now() });
  await ctx.scheduler.runAfter(0, internal.quests.join.joinJourneyPage, { launch });
}

async function previewOnce(ctx: MutationCtx, workspace: string, member: MemberId) {
  if ((await previewMomentOf(ctx, member)) !== null) return;
  const at = Date.now();
  await ctx.db.insert("previewMoments", { member, moment: "journey", at });
  await joinMember(ctx, workspace, member, at);
}

function journeyLaunchIn(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("journeyLaunches")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}

function previewMomentOf(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("previewMoments")
    .withIndex("by_member_moment", (q) => q.eq("member", member).eq("moment", "journey"))
    .unique();
}
