import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { exposed, memberDecision, memberDecisionBeforeWriting, memberDecisionWithoutWriting, workspaceDecision, workspaceDecisionWithoutWriting, type Flag } from "../analytics/flags";
import { bookLaunchDueIn } from "../achievements/flag";
import { workspaceKeyOf } from "../analytics/outbox";
import { journeyLaunchDueIn, journeyPreviewedBy } from "../quests/flag";
import { signInWorkspace } from "../slack/signIn";
import { unlocksLaunchDueIn, unlocksPreviewedBy } from "../unlocks/launch";
import { chatUserOf, type MemberId } from "../workspace/directory";

export const websiteFlag = { key: "website", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export function websiteOpen(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  return websiteFlagThrough(ctx, workspaceDecision);
}

export function websiteOpenWithoutWriting(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  return websiteFlagThrough(ctx, workspaceDecisionWithoutWriting);
}

export function websiteOpenTo(ctx: QueryCtx | MutationCtx, member: MemberId): Promise<boolean> {
  return memberDecisionWithoutWriting(ctx, websiteFlag, member);
}

export async function websiteShownTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const shown = await memberDecision(ctx, websiteFlag, member);
  await exposed(ctx, websiteFlag, member, shown);
  if (shown) await runDuePreviewMoments(ctx, member);
  return shown;
}

export async function websiteAdmits(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const decision = await memberDecisionBeforeWriting(ctx, websiteFlag, member);
  if (!decision.value) return false;
  await decision.keep();
  return websiteShownTo(ctx, member);
}

export async function workspaceLaunchDueIn(ctx: QueryCtx, workspace: string): Promise<boolean> {
  return (await unlocksLaunchDueIn(ctx, workspace)) || (await journeyLaunchDueIn(ctx, workspace)) || (await bookLaunchDueIn(ctx, workspace));
}

async function runDuePreviewMoments(ctx: MutationCtx, member: MemberId) {
  if (await workspaceLaunchDueIn(ctx, (await chatUserOf(ctx, member)).workspace)) return;
  await unlocksPreviewedBy(ctx, member);
  await journeyPreviewedBy(ctx, member);
}

async function websiteFlagThrough(ctx: QueryCtx | MutationCtx, read: typeof workspaceDecision): Promise<boolean> {
  const workspace = signInWorkspace();
  if (workspace === undefined) return false;
  return read(ctx, websiteFlag, workspace);
}

export const prepareWebsiteFlag = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const workspace = signInWorkspace();
    if (workspace !== undefined) await workspaceKeyOf(ctx, workspace);
    return null;
  },
});
