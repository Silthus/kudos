import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { periodValidator } from "../leaderboard/periods";
import { messageKindValidator, messagePlaceValidator } from "../messageSettings/kinds";
import { welcomePathValidator } from "../welcome/welcomedAs";
import { failuresLogged } from "./failures";
import { recordUsage, usageNotRecorded } from "./usage";

const leaderboardViewValidator = v.object({
  workspace: v.string(),
  member: v.id("members"),
  board: v.union(v.literal("everyone"), v.literal("groups"), v.literal("my-group")),
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

export const pickSurfaceValidator = v.union(v.literal("welcome"), v.literal("settings"), v.literal("website"));

const primaryGroupPickValidator = v.object({
  workspace: v.string(),
  member: v.id("members"),
  surface: pickSurfaceValidator,
  at: v.number(),
});

export type PrimaryGroupPick = Infer<typeof primaryGroupPickValidator>;

export async function reportPrimaryGroupPicked(ctx: MutationCtx, pick: PrimaryGroupPick) {
  await ctx.scheduler.runAfter(0, internal.analytics.isolatedUsage.recordPrimaryGroupPicked, pick);
}

export const recordPrimaryGroupPicked = internalMutation({
  args: primaryGroupPickValidator,
  handler: async (ctx, pick): Promise<void> => {
    await failuresLogged(usageNotRecorded, () => recordUsage(ctx, { kind: "primaryGroupPicked", ...pick }));
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

const hugsRecapValidator = v.object({
  workspace: v.string(),
  member: v.id("members"),
  given: v.number(),
  received: v.number(),
  xp: v.number(),
  at: v.number(),
});

export type HugsRecap = Infer<typeof hugsRecapValidator>;

export async function reportHugsRecapSent(ctx: MutationCtx, recap: HugsRecap) {
  await ctx.scheduler.runAfter(0, internal.analytics.isolatedUsage.recordHugsRecapSent, recap);
}

export const recordHugsRecapSent = internalMutation({
  args: hugsRecapValidator,
  handler: async (ctx, recap): Promise<void> => {
    await failuresLogged(usageNotRecorded, () => recordUsage(ctx, { kind: "hugsRecapSent", ...recap }));
  },
});

const sentDmValidator = v.union(
  v.object({ kind: v.literal("welcome"), path: welcomePathValidator }),
  v.object({ kind: v.literal("monday"), sections: v.array(v.union(v.literal("hugs"), v.literal("quests"))) }),
);

const dmSentValidator = v.object({
  workspace: v.string(),
  member: v.id("members"),
  dm: sentDmValidator,
  at: v.number(),
});

export type DmSent = Infer<typeof dmSentValidator>;

export async function reportDmSent(ctx: MutationCtx, sent: DmSent) {
  await ctx.scheduler.runAfter(0, internal.analytics.isolatedUsage.recordDmSent, sent);
}

export const recordDmSent = internalMutation({
  args: dmSentValidator,
  handler: async (ctx, sent): Promise<void> => {
    await failuresLogged(usageNotRecorded, () => recordUsage(ctx, { kind: "dmSent", ...sent }));
  },
});

const xpMomentEndingValidator = v.object({
  workspace: v.string(),
  member: v.id("members"),
  skipped: v.boolean(),
  excerptsShown: v.number(),
  folded: v.number(),
  at: v.number(),
});

export type XpMomentEnding = Infer<typeof xpMomentEndingValidator>;

export async function reportXpMomentEnded(ctx: MutationCtx, ending: XpMomentEnding) {
  await ctx.scheduler.runAfter(0, internal.analytics.isolatedUsage.recordXpMomentEnded, ending);
}

export const recordXpMomentEnded = internalMutation({
  args: xpMomentEndingValidator,
  handler: async (ctx, ending): Promise<void> => {
    await failuresLogged(usageNotRecorded, () => recordUsage(ctx, { kind: "xpMomentEnded", ...ending }));
  },
});

const howItWorksCloseValidator = v.object({
  workspace: v.string(),
  member: v.id("members"),
  triedSlack: v.boolean(),
  at: v.number(),
});

export type HowItWorksClose = Infer<typeof howItWorksCloseValidator>;

export async function reportHowItWorksClosed(ctx: MutationCtx, close: HowItWorksClose) {
  await ctx.scheduler.runAfter(0, internal.analytics.isolatedUsage.recordHowItWorksClosed, close);
}

export const recordHowItWorksClosed = internalMutation({
  args: howItWorksCloseValidator,
  handler: async (ctx, close): Promise<void> => {
    await failuresLogged(usageNotRecorded, () => recordUsage(ctx, { kind: "howItWorksClosed", ...close }));
  },
});
