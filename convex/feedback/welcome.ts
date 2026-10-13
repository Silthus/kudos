import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalQuery, type MutationCtx } from "../_generated/server";
import { chatUserOf, type MemberId } from "../workspace/directory";
import { settingsOf } from "../workspace/settings";

export type WelcomeMessage = { lines: string[]; openAppHome: string };

export async function requestWelcome(ctx: MutationCtx, member: MemberId) {
  const { workspace, user } = await chatUserOf(ctx, member);
  await ctx.scheduler.runAfter(0, internal.slack.welcome.deliverWelcome, { workspace, user, attempt: 1 });
}

export const welcomeMessage = internalQuery({
  args: { workspace: v.string() },
  handler: async (ctx, { workspace }): Promise<WelcomeMessage> => {
    const { baseAllowance, kudosEmoji } = await settingsOf(ctx, workspace);
    const emoji = `:${kudosEmoji}:`;
    return {
      lines: [
        `👋 Welcome to Kudos! Thank a teammate by mentioning them and adding ${emoji} to your message in any channel I'm in. Each ${emoji} gives everyone you mention 1 kudos.`,
        `You can give ${baseAllowance} kudos a day, and they refill at midnight in your time zone.`,
        "To add me to a channel, type `/kudos` there.",
      ],
      openAppHome: "Open App Home",
    };
  },
});
