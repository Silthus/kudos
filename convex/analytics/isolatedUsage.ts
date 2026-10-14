import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { periodValidator } from "../leaderboard/periods";
import { failuresLogged } from "./failures";
import { recordUsage, usageNotRecorded } from "./usage";

const leaderboardViewValidator = v.object({
  workspace: v.string(),
  member: v.id("members"),
  board: v.literal("everyone"),
  period: periodValidator,
  surface: v.union(v.literal("app-home"), v.literal("command")),
  at: v.number(),
});

export type LeaderboardView = Infer<typeof leaderboardViewValidator>;

export async function reportLeaderboardViewed(ctx: MutationCtx, view: LeaderboardView) {
  await ctx.scheduler.runAfter(0, internal.analytics.isolatedUsage.recordLeaderboardViewed, view);
}

export const recordLeaderboardViewed = internalMutation({
  args: leaderboardViewValidator,
  handler: async (ctx, view): Promise<void> => {
    await failuresLogged(usageNotRecorded, () => recordUsage(ctx, { kind: "leaderboardViewed", ...view }));
  },
});
