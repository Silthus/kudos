import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { republish } from "../feedback/homes";
import { notifyFeaturesShipped } from "../feedback/notify";
import { levelOf } from "../progression/levels";
import { xpLevelsOnFor } from "../progression/xpLevels";
import { unlocksLiveIn, unlocksOpenedFor } from "./launch";
import { schedule, shippedTo } from "./schedule";
import { reachedAt, storeReadiness, withoutReadiness } from "./unlocks";

const membersPerSweep = 25;

export const sweep = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }): Promise<void> => {
    const launched = launchOncePerWorkspace(ctx);
    const members = await ctx.db.query("members").paginate({ numItems: membersPerSweep, cursor: cursor ?? null });
    for (const member of members.page) {
      if (member.kind !== "member") continue;
      await launched(member.workspace);
      await makeShippedReady(ctx, member);
    }
    if (!members.isDone) await ctx.scheduler.runAfter(0, internal.unlocks.sweep.sweep, { cursor: members.continueCursor });
  },
});

async function makeShippedReady(ctx: MutationCtx, { _id: member, workspace }: Doc<"members">) {
  const due = await shippedTo(ctx, member, await withoutReadiness(ctx, member, reachedAt(schedule.features, await levelOfMember(ctx, member))));
  if (due.length === 0) return;
  const previewStarted = (await unlocksOpenedFor(ctx, workspace, member)) === "previewStarted";
  const madeReady = await storeReadiness(ctx, { workspace, member, at: Date.now() }, due);
  if (madeReady.length > 0) await notifyFeaturesShipped(ctx, member, madeReady);
  if (previewStarted || (madeReady.length > 0 && (await xpLevelsOnFor(ctx, member)))) await republish(ctx, member);
}

function launchOncePerWorkspace(ctx: MutationCtx) {
  const byWorkspace = new Map<string, Promise<boolean>>();
  return (workspace: string) => {
    if (!byWorkspace.has(workspace)) byWorkspace.set(workspace, unlocksLiveIn(ctx, workspace));
    return byWorkspace.get(workspace)!;
  };
}

async function levelOfMember(ctx: MutationCtx, member: Doc<"members">["_id"]) {
  const progress = await ctx.db
    .query("memberProgress")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
  return levelOf(progress?.xp ?? 0);
}
