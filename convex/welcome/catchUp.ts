import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { memberDecision } from "../analytics/flags";
import { hasGivenAnAward, hasReceivedAnAward } from "../engine/awards";
import { hasHuggedBefore } from "../hugs/records";
import { onTheMondayPath } from "../quests/flag";
import type { MemberId } from "../workspace/directory";
import { catchUpWelcomeFlag } from "./catchUpFlag";
import { isWelcomed, welcomeOnTheMondayPath } from "./welcome";

export const catchUpWelcomes = internalMutation({
  args: { workspace: v.string(), cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { workspace, cursor = null }): Promise<void> => {
    const { page, isDone, continueCursor } = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("workspace", workspace))
      .paginate({ cursor, numItems: 1 });
    for (const member of page) if (await catchesUp(ctx, member)) await welcomeOnTheMondayPath(ctx, member._id, { path: "catch-up" }, Date.now());
    if (!isDone) await ctx.scheduler.runAfter(0, internal.welcome.catchUp.catchUpWelcomes, { workspace, cursor: continueCursor });
  },
});

async function catchesUp(ctx: MutationCtx, { _id: member, kind }: Doc<"members">): Promise<boolean> {
  if (kind !== "member" || (await isWelcomed(ctx, member))) return false;
  if (!(await usedHedgeHug(ctx, member)) || !(await onTheMondayPath(ctx, member))) return false;
  return memberDecision(ctx, catchUpWelcomeFlag, member);
}

async function usedHedgeHug(ctx: MutationCtx, member: MemberId): Promise<boolean> {
  return (await hasHuggedBefore(ctx, member)) || (await hasGivenAnAward(ctx, member)) || (await hasReceivedAnAward(ctx, member));
}
