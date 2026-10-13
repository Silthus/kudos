import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import type { WelcomeMessage } from "../feedback/welcome";
import { appHomeLink } from "./appHome";
import { attemptArgs, sendOnce, tryAtMostThreeTimes } from "./delivery";

export const deliverWelcome = internalAction({
  args: { workspace: v.string(), user: v.string(), ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...welcome }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const message = await ctx.runQuery(internal.feedback.welcome.welcomeMessage, { workspace: welcome.workspace });
        return sendOnce(ctx, welcome.workspace, "chat.postMessage", { channel: welcome.user, text: textOf(message, welcome.workspace) }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.welcome.deliverWelcome, { ...welcome, attempt: retry.attempt }),
    );
  },
});

function textOf(welcome: WelcomeMessage, workspace: string) {
  return [...welcome.lines, appHomeLink(workspace, welcome.openAppHome)].join("\n");
}
