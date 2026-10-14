import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { achievementsLiveIn } from "../achievements/flag";
import { exposed, memberDecision, workspaceDecision, type Flag } from "../analytics/flags";
import type { UnlocksLaunchedEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { xpLevelsOnFor, xpLevelsShownIn, xpLevelsShownTo } from "../progression/xpLevels";
import { chatUserOf, lookup, type MemberId } from "../workspace/directory";
import { previewMomentOf } from "./previewMoments";
import { shippedIn, shippedTo } from "./schedule";
import { keepOpen } from "./unlocks";

export const unlocksFlag = { key: "unlocks", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean>;

export type UnlocksFor = "off" | "live" | "previewStarted";

export async function unlocksShownTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  if (!(await xpLevelsShownTo(ctx, member))) return false;
  const shown = (await unlocksLiveFor(ctx, member)) !== "off";
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

export async function unlocksLiveFor(ctx: MutationCtx, member: MemberId): Promise<UnlocksFor> {
  const { workspace } = await chatUserOf(ctx, member);
  await unlocksLiveIn(ctx, workspace);
  return unlocksOpenedFor(ctx, workspace, member);
}

export async function unlocksOpenedFor(ctx: MutationCtx, workspace: string, member: MemberId): Promise<UnlocksFor> {
  if (!(await unlocksOnFor(ctx, member))) return "off";
  if ((await launchIn(ctx, workspace)) !== null || !(await previewOnce(ctx, workspace, member))) return "live";
  return "previewStarted";
}

export async function unlocksLiveIn(ctx: MutationCtx, workspace: string): Promise<boolean> {
  if (!(await unlocksOnIn(ctx, workspace))) return false;
  if ((await launchIn(ctx, workspace)) === null) await launch(ctx, workspace);
  await achievementsLiveIn(ctx, workspace);
  return true;
}

export async function unlocksPreviewedBy(ctx: MutationCtx, member: MemberId): Promise<void> {
  const { workspace } = await chatUserOf(ctx, member);
  if (!(await unlocksOnIn(ctx, workspace))) await unlocksOpenedFor(ctx, workspace, member);
}

export async function unlockPathShownIn(ctx: QueryCtx, workspace: string): Promise<boolean> {
  return (await xpLevelsShownIn(ctx, workspace)) && (await unlocksAppliedIn(ctx, workspace));
}

export async function unlockPathShownTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  return (await xpLevelsOnFor(ctx, member)) && (await unlocksAppliedTo(ctx, member));
}

export async function unlocksAppliedIn(ctx: QueryCtx, workspace: string): Promise<boolean> {
  return (await launchIn(ctx, workspace)) !== null && (await workspaceDecision(ctx, unlocksFlag, workspace));
}

export async function unlocksAppliedTo(ctx: QueryCtx, member: MemberId): Promise<boolean> {
  if (!(await memberDecision(ctx, unlocksFlag, member))) return false;
  const { workspace } = await chatUserOf(ctx, member);
  return (await launchIn(ctx, workspace)) !== null || (await previewMomentOf(ctx, member, "unlocks")) !== null;
}

async function unlocksOnIn(ctx: MutationCtx, workspace: string) {
  return (await xpLevelsShownIn(ctx, workspace)) && (await workspaceDecision(ctx, unlocksFlag, workspace));
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
  const openings: UnlocksLaunchedEvent["openings"] = [];
  for (const { _id: member, kind } of existing) {
    if (kind !== "member") continue;
    for (const { feature } of shipped) {
      if (await keepOpen(ctx, { workspace, member, at, byLaunch: true }, feature)) openings.push({ member, feature });
    }
  }
  for (const page of pagesOf(openings)) await publish(ctx, { type: "unlocksLaunched", workspace, openings: page, at });
}

const openingsPerEvent = 1000;

function pagesOf(openings: UnlocksLaunchedEvent["openings"]) {
  return Array.from({ length: Math.ceil(openings.length / openingsPerEvent) }, (_, page) => openings.slice(page * openingsPerEvent, (page + 1) * openingsPerEvent));
}

async function previewOnce(ctx: MutationCtx, workspace: string, member: MemberId) {
  if ((await previewMomentOf(ctx, member, "unlocks")) !== null) return false;
  const at = Date.now();
  await ctx.db.insert("previewMoments", { member, moment: "unlocks", at });
  const openings: UnlocksLaunchedEvent["openings"] = [];
  for (const { feature } of await shippedTo(ctx, member)) {
    if (await keepOpen(ctx, { workspace, member, at, byLaunch: true }, feature)) openings.push({ member, feature });
  }
  if (openings.length > 0) await publish(ctx, { type: "unlocksLaunched", workspace, openings, at });
  return true;
}

function launchIn(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("unlockLaunches")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}
