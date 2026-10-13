import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { LevelReachedEvent } from "../bus/events";
import { skillTreeLevel } from "../progression/levels";
import { progressSettingsOf } from "../progression/settings";
import { xpLevelsShownIn, xpLevelsShownTo } from "../progression/xpLevels";
import { questsApplyIn } from "../quests/flag";
import { journeyQuestValidator, weeklyQuestValidator, type JourneyQuest, type WeeklyQuest } from "../quests/step";
import { featureValidator } from "../unlocks/feature";
import { unlocksAppliedIn, unlocksShownTo } from "../unlocks/launch";
import { scheduled, shippedIn, type ScheduledFeature } from "../unlocks/schedule";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { finishedQuestCrateOf, finishedWeeklyQuestCrateOf, readyCrateOf, type HomeAction } from "./home";
import { skillPointsOf } from "./naming";
import { whenOpened } from "./unlockFilter";

export const notificationValidator = v.union(
  v.object({
    kind: v.literal("level-reached"),
    level: v.number(),
    skillPoints: v.union(v.number(), v.null()),
    xpToNextLevel: v.number(),
    ready: v.array(featureValidator),
  }),
  v.object({ kind: v.literal("features-shipped"), ready: v.array(featureValidator) }),
  v.object({ kind: v.literal("quest-finished"), quest: journeyQuestValidator, xp: v.number() }),
  v.object({ kind: v.literal("weekly-quest-finished"), quest: weeklyQuestValidator, goal: v.string(), xp: v.number() }),
);

export type Notification = Infer<typeof notificationValidator>;

export type NotificationLine = string | { text: string; action: HomeAction };

export async function notifyLevelReached(ctx: MutationCtx, { member, level, skillPoints, xpToNextLevel }: LevelReachedEvent, ready: ScheduledFeature[]) {
  if (!(await xpLevelsShownTo(ctx, member))) return;
  const unlocksShown = await unlocksShownTo(ctx, member);
  await notify(ctx, member, { kind: "level-reached", level, skillPoints, xpToNextLevel, ready: unlocksShown ? featuresOf(ready) : [] });
}

export async function notifyFeaturesShipped(ctx: MutationCtx, member: MemberId, ready: ScheduledFeature[]) {
  if (!(await unlocksShownTo(ctx, member))) return;
  await notify(ctx, member, { kind: "features-shipped", ready: featuresOf(ready) });
}

export async function notifyQuestFinished(ctx: MutationCtx, member: MemberId, quest: JourneyQuest, xp: number) {
  await notify(ctx, member, { kind: "quest-finished", quest, xp });
}

export async function notifyWeeklyQuestFinished(ctx: MutationCtx, member: MemberId, quest: WeeklyQuest, goal: string, xp: number) {
  await notify(ctx, member, { kind: "weekly-quest-finished", quest, goal, xp });
}

export async function notify(ctx: MutationCtx, member: MemberId, notification: Notification) {
  if (!(await wantsDms(ctx, member))) return;
  const { workspace, user } = await chatUserOf(ctx, member);
  await ctx.scheduler.runAfter(0, internal.slack.directMessages.deliverDirectMessage, { member, workspace, user, notification });
}

export const linesStillWanted = internalQuery({
  args: { member: v.id("members"), notification: notificationValidator },
  handler: async (ctx, { member, notification }): Promise<NotificationLine[] | null> => {
    const { workspace } = await chatUserOf(ctx, member);
    if (!(await xpLevelsShownIn(ctx, workspace)) || !(await wantsDms(ctx, member))) return null;
    if (isAboutQuests(notification) && !(await questsApplyIn(ctx, workspace))) return null;
    const lines = renderNotification(await stillToldOf(ctx, workspace, member, notification));
    return lines.length === 0 ? null : lines;
  },
});

export function renderNotification(notification: Notification): NotificationLine[] {
  if (notification.kind === "quest-finished") return [finishedQuestCrateOf(notification.quest, notification.xp)];
  if (notification.kind === "weekly-quest-finished") return [finishedWeeklyQuestCrateOf(notification.quest, notification.goal, notification.xp)];
  const crates = notification.ready.map((feature) => readyCrateOf(scheduled(feature)));
  return notification.kind === "level-reached" ? [...levelReachedLines(notification), ...crates] : crates;
}

function levelReachedLines({ level, skillPoints, xpToNextLevel }: Extract<Notification, { kind: "level-reached" }>) {
  const reached = `🎉 You reached level ${level}!`;
  const headline = skillPoints !== null && level >= skillTreeLevel ? `${reached} You have ${skillPointsOf(skillPoints)} saved for the skill tree.` : reached;
  return [headline, `Level ${level + 1} is ${xpToNextLevel} XP away.`];
}

async function stillToldOf(ctx: QueryCtx, workspace: string, member: MemberId, notification: Notification): Promise<Notification> {
  if (isAboutQuests(notification)) return notification;
  if (!(await unlocksAppliedIn(ctx, workspace))) return { ...notification, ready: [] };
  const shipped = (await shippedIn(ctx, workspace)).map(({ feature }) => feature);
  const ready = notification.ready.filter((feature) => shipped.includes(feature));
  if (notification.kind !== "level-reached" || notification.skillPoints === null) return { ...notification, ready };
  return { ...notification, ready, skillPoints: await whenOpened(ctx, member, "skillTree", notification.skillPoints) };
}

function isAboutQuests(notification: Notification): notification is Extract<Notification, { kind: "quest-finished" | "weekly-quest-finished" }> {
  return notification.kind === "quest-finished" || notification.kind === "weekly-quest-finished";
}

function featuresOf(ready: ScheduledFeature[]) {
  return ready.map(({ feature }) => feature);
}

async function wantsDms(ctx: QueryCtx, member: MemberId) {
  return (await progressSettingsOf(ctx, member)).dms;
}
