import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { exposed, flag, type Flag } from "../analytics/flags";
import type { UnlocksLaunchedEvent } from "../bus/events";
import { publish } from "../bus/publish";
import { xpLevels, xpLevelsShownTo } from "../progression/xpLevels";
import { chatUserOf, lookup, type MemberId } from "../workspace/directory";
import { shippedIn } from "./schedule";
import { keepOpen } from "./unlocks";

export const unlocksFlag = { key: "unlocks", subject: "workspace", safeDefault: false, values: [false, true] } as const satisfies Flag<boolean, "workspace">;

export async function unlocksShownTo(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  if (!(await xpLevelsShownTo(ctx, member))) return false;
  const { workspace } = await chatUserOf(ctx, member);
  const live = await unlocksLiveIn(ctx, workspace);
  await exposed(ctx, unlocksFlag, member, live);
  return live;
}

export const exposeUnlocks = internalMutation({
  args: { workspace: v.string(), user: v.string(), shown: v.boolean() },
  handler: async (ctx, { workspace, user, shown }) => {
    const person = await lookup(ctx, workspace, user);
    if (person?.kind !== "member") return;
    await exposed(ctx, xpLevels, person.member, true);
    await exposed(ctx, unlocksFlag, person.member, shown);
  },
});

export async function unlocksLiveIn(ctx: MutationCtx, workspace: string): Promise<boolean> {
  if (!(await flag(ctx, unlocksFlag, { workspace }))) return false;
  if ((await launchIn(ctx, workspace)) === null) await launch(ctx, workspace);
  return true;
}

export async function unlocksAppliedIn(ctx: QueryCtx, workspace: string): Promise<boolean> {
  return (await launchIn(ctx, workspace)) !== null && (await flag(ctx, unlocksFlag, { workspace }));
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
  if (openings.length > 0) await publish(ctx, { type: "unlocksLaunched", workspace, openings, at });
}

function launchIn(ctx: QueryCtx, workspace: string) {
  return ctx.db
    .query("unlockLaunches")
    .withIndex("by_workspace", (q) => q.eq("workspace", workspace))
    .unique();
}
