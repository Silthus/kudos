import { internal } from "../_generated/api";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { LevelReachedEvent } from "../bus/events";
import { skillTreeLevel } from "../progression/levels";
import { progressSettingsOf } from "../progression/settings";
import { xpLevelsShownTo } from "../progression/xpLevels";
import type { ScheduledFeature } from "../unlocks/schedule";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { readyCrateOf, type HomeAction } from "./home";
import { skillPointsOf } from "./naming";
import { whenOpened } from "./unlockFilter";

export type Notification =
  | { kind: "level-reached"; level: number; skillPoints: number | null; xpToNextLevel: number; ready: ScheduledFeature[] }
  | { kind: "features-shipped"; ready: ScheduledFeature[] };

export type NotificationLine = string | { text: string; action: HomeAction };

export async function notifyLevelReached(ctx: MutationCtx, { member, level, skillPoints, xpToNextLevel }: LevelReachedEvent, ready: ScheduledFeature[]) {
  if (!(await xpLevelsShownTo(ctx, member))) return;
  const toldSkillPoints = await whenOpened(ctx, member, "skillTree", skillPoints);
  await notify(ctx, member, { kind: "level-reached", level, skillPoints: toldSkillPoints, xpToNextLevel, ready });
}

export async function notifyFeaturesShipped(ctx: MutationCtx, member: MemberId, ready: ScheduledFeature[]) {
  if (!(await xpLevelsShownTo(ctx, member))) return;
  await notify(ctx, member, { kind: "features-shipped", ready });
}

export async function notify(ctx: MutationCtx, member: MemberId, notification: Notification) {
  if (!(await wantsDms(ctx, member))) return;
  const { workspace, user } = await chatUserOf(ctx, member);
  await ctx.scheduler.runAfter(0, internal.slack.directMessages.deliverDirectMessage, { workspace, user, lines: renderNotification(notification) });
}

export function renderNotification(notification: Notification): NotificationLine[] {
  const crates = notification.ready.map(readyCrateOf);
  return notification.kind === "level-reached" ? [...levelReachedLines(notification), ...crates] : crates;
}

function levelReachedLines({ level, skillPoints, xpToNextLevel }: Extract<Notification, { kind: "level-reached" }>) {
  const reached = `🎉 You reached level ${level}!`;
  const headline = skillPoints !== null && level >= skillTreeLevel ? `${reached} You have ${skillPointsOf(skillPoints)} saved for the skill tree.` : reached;
  return [headline, `Level ${level + 1} is ${xpToNextLevel} XP away.`];
}

async function wantsDms(ctx: QueryCtx, member: MemberId) {
  return (await progressSettingsOf(ctx, member)).dms;
}
