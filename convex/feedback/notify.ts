import { internal } from "../_generated/api";
import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import { levelReachedEventValidator } from "../bus/events";
import { skillTreeLevel } from "../progression/levels";
import { progressSettingsOf } from "../progression/settings";
import { xpLevelsShownIn, xpLevelsShownTo } from "../progression/xpLevels";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { skillPointsOf } from "./naming";

export type Notification = { kind: "level-reached"; level: number; skillPoints: number; xpToNextLevel: number };

export const notifyLevelReached = internalMutation({
  args: { event: levelReachedEventValidator },
  handler: async (ctx, { event: { member, level, skillPoints, xpToNextLevel } }): Promise<void> => {
    if (!(await xpLevelsShownTo(ctx, member))) return;
    await notify(ctx, member, { kind: "level-reached", level, skillPoints, xpToNextLevel });
  },
});

export async function notify(ctx: MutationCtx, member: MemberId, notification: Notification) {
  if (!(await wantsDms(ctx, member))) return;
  const { workspace, user } = await chatUserOf(ctx, member);
  await ctx.scheduler.runAfter(0, internal.slack.directMessages.deliverDirectMessage, { member, workspace, user, lines: renderNotification(notification) });
}

export const isStillWanted = internalQuery({
  args: { member: v.id("members") },
  handler: async (ctx, { member }): Promise<boolean> => {
    const { workspace } = await chatUserOf(ctx, member);
    return (await xpLevelsShownIn(ctx, workspace)) && (await wantsDms(ctx, member));
  },
});

export function renderNotification({ level, skillPoints, xpToNextLevel }: Notification): string[] {
  const reached = `🎉 You reached level ${level}!`;
  const headline = level >= skillTreeLevel ? `${reached} You have ${skillPointsOf(skillPoints)} saved for the skill tree.` : reached;
  return [headline, `Level ${level + 1} is ${xpToNextLevel} XP away.`];
}

async function wantsDms(ctx: QueryCtx, member: MemberId) {
  return (await progressSettingsOf(ctx, member)).dms;
}
