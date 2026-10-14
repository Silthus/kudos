import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { exposed, memberDecision, memberDecisionWithoutWriting, workspaceDecision, workspaceDecisionWithoutWriting, type Flag } from "../analytics/flags";
import { workspaceKeyOf } from "../analytics/outbox";
import { journeyPreviewedBy } from "../quests/flag";
import { signInWorkspace } from "../slack/signIn";
import { unlocksPreviewedBy } from "../unlocks/launch";
import type { MemberId } from "../workspace/directory";

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

async function runDuePreviewMoments(ctx: MutationCtx, member: MemberId) {
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
