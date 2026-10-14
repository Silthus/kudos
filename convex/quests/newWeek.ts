import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { questsLiveIn } from "./flag";
import { awaitsThisWeeksDraw } from "./weekly";

const membersPerSweep = 100;

export const sweep = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }): Promise<void> => {
    const now = Date.now();
    const live = sliceLiveIn(ctx);
    const members = await ctx.db.query("members").paginate({ numItems: membersPerSweep, cursor: cursor ?? null });
    for (const member of members.page) {
      if (await isDueANewWeek(ctx, member, now, live)) await ctx.scheduler.runAfter(0, internal.quests.weekly.drawNewWeek, { member: member._id });
    }
    if (!members.isDone) await ctx.scheduler.runAfter(0, internal.quests.newWeek.sweep, { cursor: members.continueCursor });
  },
});

async function isDueANewWeek(ctx: MutationCtx, member: Doc<"members">, at: number, live: (workspace: string) => Promise<boolean>) {
  return member.kind === "member" && (await live(member.workspace)) && (await awaitsThisWeeksDraw(ctx, member, at));
}

function sliceLiveIn(ctx: MutationCtx) {
  const byWorkspace = new Map<string, Promise<boolean>>();
  return (workspace: string) => {
    if (!byWorkspace.has(workspace)) byWorkspace.set(workspace, questsLiveIn(ctx, workspace));
    return byWorkspace.get(workspace)!;
  };
}
