import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { questsApplyTo, questsLiveIn } from "./flag";
import { awaitsThisWeeksDraw } from "./weekly";

const membersPerSweep = 100;

export const sweep = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }): Promise<void> => {
    const now = Date.now();
    const launched = launchOncePerWorkspace(ctx);
    const members = await ctx.db.query("members").paginate({ numItems: membersPerSweep, cursor: cursor ?? null });
    for (const member of members.page) {
      if (member.kind !== "member") continue;
      await launched(member.workspace);
      if (await isDueANewWeek(ctx, member, now)) await ctx.scheduler.runAfter(0, internal.quests.weekly.drawNewWeek, { member: member._id });
    }
    if (!members.isDone) await ctx.scheduler.runAfter(0, internal.quests.newWeek.sweep, { cursor: members.continueCursor });
  },
});

async function isDueANewWeek(ctx: MutationCtx, member: Doc<"members">, at: number) {
  return (await awaitsThisWeeksDraw(ctx, member, at)) && (await questsApplyTo(ctx, member._id));
}

function launchOncePerWorkspace(ctx: MutationCtx) {
  const byWorkspace = new Map<string, Promise<boolean>>();
  return (workspace: string) => {
    if (!byWorkspace.has(workspace)) byWorkspace.set(workspace, questsLiveIn(ctx, workspace));
    return byWorkspace.get(workspace)!;
  };
}
