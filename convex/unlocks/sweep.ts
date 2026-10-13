import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { republish } from "../feedback/homes";
import { notifyFeaturesShipped } from "../feedback/notify";
import { levelOf } from "../progression/levels";
import { xpLevelsShownIn } from "../progression/xpLevels";
import { unlocksLiveIn } from "./launch";
import { shippedIn, type ScheduledFeature } from "./schedule";
import { reachedAt, storeReadiness } from "./unlocks";

const membersPerSweep = 100;

export const sweep = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }): Promise<void> => {
    const shipped = shipStates(ctx);
    const members = await ctx.db.query("members").paginate({ numItems: membersPerSweep, cursor: cursor ?? null });
    for (const member of members.page) {
      if (member.kind !== "member") continue;
      await makeShippedReady(ctx, member, await shipped(member.workspace));
    }
    if (!members.isDone) await ctx.scheduler.runAfter(0, internal.unlocks.sweep.sweep, { cursor: members.continueCursor });
  },
});

async function makeShippedReady(ctx: MutationCtx, { _id: member, workspace }: Doc<"members">, shipped: ScheduledFeature[]) {
  if (shipped.length === 0) return;
  const madeReady = await storeReadiness(ctx, { workspace, member, at: Date.now() }, reachedAt(shipped, await levelOfMember(ctx, member)));
  if (madeReady.length === 0) return;
  await notifyFeaturesShipped(ctx, member, madeReady);
  if (await xpLevelsShownIn(ctx, workspace)) await republish(ctx, member);
}

function shipStates(ctx: MutationCtx) {
  const byWorkspace = new Map<string, Promise<ScheduledFeature[]>>();
  return (workspace: string) => {
    if (!byWorkspace.has(workspace)) byWorkspace.set(workspace, launchedThenShipped(ctx, workspace));
    return byWorkspace.get(workspace)!;
  };
}

async function launchedThenShipped(ctx: MutationCtx, workspace: string) {
  await unlocksLiveIn(ctx, workspace);
  return shippedIn(ctx, workspace);
}

async function levelOfMember(ctx: MutationCtx, member: Doc<"members">["_id"]) {
  const progress = await ctx.db
    .query("memberProgress")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
  return levelOf(progress?.xp ?? 0);
}
