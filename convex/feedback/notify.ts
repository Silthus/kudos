import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { levelReachedEventValidator } from "../bus/events";
import { chatUserOf, type MemberId } from "../workspace/directory";

export type Notification = { kind: "level-reached"; level: number; skillPoints: number; xpToNextLevel: number };

export const notifyLevelReached = internalMutation({
  args: { event: levelReachedEventValidator },
  handler: async (ctx, { event: { member, level, skillPoints, xpToNextLevel } }): Promise<void> => {
    await notify(ctx, member, { kind: "level-reached", level, skillPoints, xpToNextLevel });
  },
});

export async function notify(ctx: MutationCtx, member: MemberId, notification: Notification) {
  if (!(await wantsDms(ctx, member))) return;
  const { workspace, user } = await chatUserOf(ctx, member);
  await ctx.scheduler.runAfter(0, internal.slack.directMessages.deliverDirectMessage, { workspace, user, lines: renderNotification(notification) });
}

export function renderNotification({ level, skillPoints, xpToNextLevel }: Notification): string[] {
  return [`🎉 You reached level ${level}! You have ${skillPointsOf(skillPoints)} saved for perks.`, `Level ${level + 1} is ${xpToNextLevel} XP away.`];
}

async function wantsDms(ctx: QueryCtx, member: MemberId) {
  const settings = await ctx.db
    .query("progressSettings")
    .withIndex("by_member", (q) => q.eq("member", member))
    .unique();
  return settings?.dms ?? true;
}

function skillPointsOf(count: number) {
  return count === 1 ? "1 skill point" : `${count} skill points`;
}
