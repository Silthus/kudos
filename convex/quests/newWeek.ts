import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { isWelcomed } from "../welcome/welcome";
import type { MemberId } from "../workspace/directory";
import { mondayPathShownTo, questsFor, questsLiveIn } from "./flag";
import { questStartOf, startQuests } from "./start";
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
      await startQuestsOfTheWelcomed(ctx, member._id, now);
      if (await isDueANewWeek(ctx, member, now)) await ctx.scheduler.runAfter(0, internal.quests.weekly.drawNewWeek, { member: member._id });
    }
    if (!members.isDone) await ctx.scheduler.runAfter(0, internal.quests.newWeek.sweep, { cursor: members.continueCursor });
  },
});

async function isDueANewWeek(ctx: MutationCtx, member: Doc<"members">, at: number) {
  return (await awaitsThisWeeksDraw(ctx, member, at)) && (await questsFor(ctx, member._id)) !== null;
}

async function startQuestsOfTheWelcomed(ctx: MutationCtx, member: MemberId, at: number) {
  if ((await questStartOf(ctx, member)) !== null || !(await isWelcomed(ctx, member))) return;
  if (await mondayPathShownTo(ctx, member)) await startQuests(ctx, member, at);
}

function launchOncePerWorkspace(ctx: MutationCtx) {
  const byWorkspace = new Map<string, Promise<boolean>>();
  return (workspace: string) => {
    if (!byWorkspace.has(workspace)) byWorkspace.set(workspace, questsLiveIn(ctx, workspace));
    return byWorkspace.get(workspace)!;
  };
}
