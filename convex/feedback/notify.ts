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

export type Notification = { kind: "level-reached"; level: number; skillPoints: number; xpToNextLevel: number; ready: ScheduledFeature[] };

export type NotificationLine = string | { text: string; action: HomeAction };

export async function notifyLevelReached(ctx: MutationCtx, { member, level, skillPoints, xpToNextLevel, at }: LevelReachedEvent, ready: ScheduledFeature[]) {
  if (!(await xpLevelsShownTo(ctx, member))) return;
  if ((await levelUpDmOf(ctx, member, level)) !== null) return;
  await ctx.db.insert("levelUpDms", { member, level, ready: ready.map(({ feature }) => feature), at });
  await notify(ctx, member, { kind: "level-reached", level, skillPoints, xpToNextLevel, ready });
}

export async function notify(ctx: MutationCtx, member: MemberId, notification: Notification) {
  if (!(await wantsDms(ctx, member))) return;
  const { workspace, user } = await chatUserOf(ctx, member);
  await ctx.scheduler.runAfter(0, internal.slack.directMessages.deliverDirectMessage, { workspace, user, lines: renderNotification(notification) });
}

export function renderNotification({ level, skillPoints, xpToNextLevel, ready }: Notification): NotificationLine[] {
  const reached = `🎉 You reached level ${level}!`;
  const headline = level >= skillTreeLevel ? `${reached} You have ${skillPointsOf(skillPoints)} saved for the skill tree.` : reached;
  return [headline, `Level ${level + 1} is ${xpToNextLevel} XP away.`, ...ready.map(readyCrateOf)];
}

async function wantsDms(ctx: QueryCtx, member: MemberId) {
  return (await progressSettingsOf(ctx, member)).dms;
}

function levelUpDmOf(ctx: QueryCtx, member: MemberId, level: number) {
  return ctx.db
    .query("levelUpDms")
    .withIndex("by_member_level", (q) => q.eq("member", member).eq("level", level))
    .unique();
}
