import { v } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { attemptArgs, sendOnce, tryAtMostThreeTimes } from "./delivery";

const directMessageArgs = { member: v.id("members"), workspace: v.string(), user: v.string(), lines: v.array(v.string()) };

export const deliverDirectMessage = observedAction({
  args: { ...directMessageArgs, ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...message }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        if (!(await ctx.runQuery(internal.feedback.notify.isStillWanted, { member: message.member }))) return null;
        return sendOnce(ctx, message.workspace, "chat.postMessage", { channel: message.user, text: message.lines.join("\n") }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.directMessages.deliverDirectMessage, { ...message, attempt: retry.attempt }),
    );
  },
});
