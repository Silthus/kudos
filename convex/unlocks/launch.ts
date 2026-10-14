import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { exposed, memberDecision, workspaceDecision, type Flag } from "../analytics/flags";
import { xpLevelsOnFor, xpLevelsShownIn, xpLevelsShownTo } from "../progression/xpLevels";
import { chatUserOf, lookup, type MemberId } from "../workspace/directory";
import { shippedIn, shippedTo } from "./schedule";
import { keepOpen } from "./unlocks";

export const unlocksFlag = { key: "unlocks", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export async function unlocksShownTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  if (!(await xpLevelsShownTo(ctx, member))) return false;
  const shown = await unlocksLiveFor(ctx, member);
  await exposed(ctx, unlocksFlag, member, shown);
  return shown;
}

export const exposeUnlocks = internalMutation({
  args: { workspace: v.string(), user: v.string(), shown: v.boolean() },
  handler: async (ctx, { workspace, user }) => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind !== "member" || !(await xpLevelsShownTo(ctx, person.member))) return;
    await exposed(ctx, unlocksFlag, person.member, await memberDecision(ctx, unlocksFlag, person.member));
  },
});

export async function unlocksLiveFor(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  const { workspace } = await chatUserOf(ctx, member);
  await unlocksLiveIn(ctx, workspace);
  if (!(await unlocksOnFor(ctx, member))) return false;
  if ((await launchIn(ctx, workspace)) === null) await previewOnce(ctx, workspace, member);
  return true;
}

export async function unlocksLiveIn(ctx: MutationCtx, workspace: string): Promise<boolean> {
  if (!(await xpLevelsShownIn(ctx, workspace)) || !(await workspaceDecision(ctx, unlocksFlag, workspace))) return false;
  if ((await launchIn(ctx, workspace)) === null) await launch(ctx, workspace);
  return true;
}

export async function unlocksAppliedIn(ctx: QueryCtx, workspace: string): Promise<boolean> {
  return (await launchIn(ctx, workspace)) !== null && (await workspaceDecision(ctx, unlocksFlag, workspace));
}

export async function unlocksAppliedTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  if (!(await memberDecision(ctx, unlocksFlag, member))) return false;
  const { workspace } = await chatUserOf(ctx, member);
  return (await launchIn(ctx, workspace)) !== null || (await previewMomentOf(ctx, member)) !== null;
}

async function unlocksOnFor(ctx: MutationCtx, member: MemberId) {
  return (await xpLevelsOnFor(ctx, member)) && (await memberDecision(ctx, unlocksFlag, member));
}

async function launch(ctx: MutationCtx, workspace: string) {
  const at = Date.now();
  const shipped = await shippedIn(ctx, workspace);
  await ctx.db.insert("unlockLaunches", { workspace, at, shipped: shipped.map(({ feature }) => feature) });
  const existing = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("workspace", workspace))
    .collect();
  for (const { _id: member, kind } of existing) {
    if (kind !== "member") continue;
    for (const { feature } of shipped) await keepOpen(ctx, { workspace, member, at, byLaunch: true }, feature);
  }
}

async function previewOnce(ctx: MutationCtx, workspace: string, member: MemberId) {
  if ((await previewMomentOf(ctx, member)) !== null) return;
  const at = Date.now();
  await ctx.db.insert("previewMoments", { member, moment: "unlocks", at });
  for (const { feature } of await shippedTo(ctx, member)) await keepOpen(ctx, { workspace, member, at, byLaunch: true }, feature);
}

function launchIn(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("unlockLaunches")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}

function previewMomentOf(ctx: QueryCtx, member: MemberId) {
  return ctx.db
    .query("previewMoments")
    .withIndex("by_member_moment", (q) => q.eq("member", member).eq("moment", "unlocks"))
    .unique();
}
