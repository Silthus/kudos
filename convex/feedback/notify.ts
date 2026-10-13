import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { LevelReachedEvent } from "../bus/events";
import { skillTreeLevel } from "../progression/levels";
import { progressSettingsOf } from "../progression/settings";
import { xpLevelsShownIn, xpLevelsShownTo } from "../progression/xpLevels";
import { featureValidator } from "../unlocks/feature";
import { scheduled, shippedIn, type ScheduledFeature } from "../unlocks/schedule";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { readyCrateOf, type HomeAction } from "./home";
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
);

export type Notification = Infer<typeof notificationValidator>;

export type NotificationLine = string | { text: string; action: HomeAction };

export async function notifyLevelReached(ctx: MutationCtx, { member, level, skillPoints, xpToNextLevel }: LevelReachedEvent, ready: ScheduledFeature[]) {
  if (!(await xpLevelsShownTo(ctx, member))) return;
  const toldSkillPoints = await whenOpened(ctx, member, "skillTree", skillPoints);
  await notify(ctx, member, { kind: "level-reached", level, skillPoints: toldSkillPoints, xpToNextLevel, ready: featuresOf(ready) });
}

export async function notifyFeaturesShipped(ctx: MutationCtx, member: MemberId, ready: ScheduledFeature[]) {
  if (!(await xpLevelsShownTo(ctx, member))) return;
  await notify(ctx, member, { kind: "features-shipped", ready: featuresOf(ready) });
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
    const lines = renderNotification(await stillToldOf(ctx, workspace, member, notification));
    return lines.length === 0 ? null : lines;
  },
});

export function renderNotification(notification: Notification): NotificationLine[] {
  const crates = notification.ready.map((feature) => readyCrateOf(scheduled(feature)));
  return notification.kind === "level-reached" ? [...levelReachedLines(notification), ...crates] : crates;
}

function levelReachedLines({ level, skillPoints, xpToNextLevel }: Extract<Notification, { kind: "level-reached" }>) {
  const reached = `🎉 You reached level ${level}!`;
  const headline = skillPoints !== null && level >= skillTreeLevel ? `${reached} You have ${skillPointsOf(skillPoints)} saved for the skill tree.` : reached;
  return [headline, `Level ${level + 1} is ${xpToNextLevel} XP away.`];
}

async function stillToldOf(ctx: QueryCtx, workspace: string, member: MemberId, notification: Notification): Promise<Notification> {
  const shipped = (await shippedIn(ctx, workspace)).map(({ feature }) => feature);
  const ready = notification.ready.filter((feature) => shipped.includes(feature));
  if (notification.kind !== "level-reached" || notification.skillPoints === null) return { ...notification, ready };
  return { ...notification, ready, skillPoints: await whenOpened(ctx, member, "skillTree", notification.skillPoints) };
}

function featuresOf(ready: ScheduledFeature[]) {
  return ready.map(({ feature }) => feature);
}

async function wantsDms(ctx: QueryCtx, member: MemberId) {
  return (await progressSettingsOf(ctx, member)).dms;
}
