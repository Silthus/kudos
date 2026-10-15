import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { periodValidator } from "../leaderboard/periods";
import { messageKindValidator, messagePlaceValidator } from "../messageSettings/kinds";
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

const leaderboardVisibilityChangeValidator = v.object({
  workspace: v.string(),
  member: v.id("members"),
  visible: v.boolean(),
  at: v.number(),
});

export type LeaderboardVisibilityChange = Infer<typeof leaderboardVisibilityChangeValidator>;

export async function reportLeaderboardVisibilityChanged(ctx: MutationCtx, change: LeaderboardVisibilityChange) {
  await ctx.scheduler.runAfter(0, internal.analytics.isolatedUsage.recordLeaderboardVisibilityChanged, change);
}

export const recordLeaderboardVisibilityChanged = internalMutation({
  args: leaderboardVisibilityChangeValidator,
  handler: async (ctx, change): Promise<void> => {
    await failuresLogged(usageNotRecorded, () => recordUsage(ctx, { kind: "leaderboardVisibilityChanged", ...change }));
  },
});

const messageSettingChangeValidator = v.object({
  workspace: v.string(),
  member: v.id("members"),
  setting: messageKindValidator,
  on: v.boolean(),
  place: v.optional(messagePlaceValidator),
  at: v.number(),
});

export type MessageSettingChange = Infer<typeof messageSettingChangeValidator>;

export async function reportMessageSettingChanged(ctx: MutationCtx, change: MessageSettingChange) {
  await ctx.scheduler.runAfter(0, internal.analytics.isolatedUsage.recordMessageSettingChanged, change);
}

export const recordMessageSettingChanged = internalMutation({
  args: messageSettingChangeValidator,
  handler: async (ctx, change): Promise<void> => {
    await failuresLogged(usageNotRecorded, () => recordUsage(ctx, { kind: "messageSettingChanged", ...change }));
  },
});
