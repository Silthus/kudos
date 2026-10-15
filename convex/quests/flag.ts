import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { achievementsApplyIn } from "../achievements/flag";
import { exposed, memberDecision, workspaceDecision } from "../analytics/flags";
import { unlockPathShownIn, unlockPathShownTo } from "../unlocks/launch";
import { storeVisibleTo } from "../store/visibility";
import { previewMomentOf } from "../unlocks/previewMoments";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { joinMember } from "./join";
import { questsFlag } from "./questsFlag";
import type { JourneyStep } from "./step";

export async function questsApplyIn(ctx: QueryCtx | MutationCtx, workspace: string): Promise<boolean> {
  return (await workspaceDecision(ctx, questsFlag, workspace)) && (await unlockPathShownIn(ctx, workspace));
}

export async function questsApplyTo(ctx: QueryCtx | MutationCtx, member: MemberId): Promise<boolean> {
  return (await memberDecision(ctx, questsFlag, member)) && (await unlockPathShownTo(ctx, member));
}

export async function journeyStepAppliesTo(ctx: QueryCtx | MutationCtx, workspace: string, member: MemberId, step: JourneyStep): Promise<boolean> {
  switch (step) {
    case "two-days":
      return achievementsApplyIn(ctx, workspace);
    case "your-emoji":
      return (await storeVisibleTo(ctx, member)) && (await journeyStartedFor(ctx, member)) !== null;
    default:
      return true;
  }
}

export async function questsShownTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  return (await questsExposedTo(ctx, member)) && (await questsLiveFor(ctx, member));
}

export async function questsExposedTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  if (!(await unlockPathShownTo(ctx, member))) return false;
  const applies = await memberDecision(ctx, questsFlag, member);
  await exposed(ctx, questsFlag, member, applies);
  return applies;
}

export async function questsLiveFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const { workspace } = await chatUserOf(ctx, member);
  await questsLiveIn(ctx, workspace);
  return questsOpenedFor(ctx, workspace, member);
}

export async function journeyPreviewedBy(ctx: MutationCtx, member: MemberId): Promise<void> {
  const { workspace } = await chatUserOf(ctx, member);
  if (!(await questsApplyIn(ctx, workspace))) await questsOpenedFor(ctx, workspace, member);
}

export async function questsLiveIn(ctx: MutationCtx, workspace: string): Promise<boolean> {
  if (!(await questsApplyIn(ctx, workspace))) return false;
  if ((await journeyLaunchIn(ctx, workspace)) === null) await launchJourney(ctx, workspace);
  return true;
}

export async function journeyLaunchDueIn(ctx: QueryCtx, workspace: string): Promise<boolean> {
  return (await questsApplyIn(ctx, workspace)) && (await journeyLaunchIn(ctx, workspace)) === null;
}

export async function journeyShippedAt(ctx: QueryCtx, workspace: string): Promise<number | null> {
  return (await journeyLaunchIn(ctx, workspace))?.at ?? null;
}

export async function journeyStartedFor(ctx: QueryCtx, member: MemberId): Promise<number | null> {
  const { workspace } = await chatUserOf(ctx, member);
  return (await journeyShippedAt(ctx, workspace)) ?? (await previewMomentOf(ctx, member, "journey"))?.at ?? null;
}

async function questsOpenedFor(ctx: MutationCtx, workspace: string, member: MemberId) {
  if (!(await questsApplyTo(ctx, member))) return false;
  if ((await journeyLaunchIn(ctx, workspace)) === null) await previewOnce(ctx, workspace, member);
  return true;
}

async function launchJourney(ctx: MutationCtx, workspace: string) {
  const launch = await ctx.db.insert("journeyLaunches", { workspace, at: Date.now() });
  await ctx.scheduler.runAfter(0, internal.quests.join.joinJourneyPage, { launch });
}

async function previewOnce(ctx: MutationCtx, workspace: string, member: MemberId) {
  if ((await previewMomentOf(ctx, member, "journey")) !== null) return;
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
