import { v } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { notificationValidator, type NotificationLine } from "../feedback/notify";
import { buttonOf, mrkdwn } from "./blocks";
import { attemptArgs, sendOnce, slackLink, tryAtMostThreeTimes } from "./delivery";

const directMessageArgs = { member: v.id("members"), workspace: v.string(), user: v.string(), notification: notificationValidator };

export const deliverDirectMessage = observedAction({
  args: { ...directMessageArgs, ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...message }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const lines = await ctx.runQuery(internal.feedback.notify.linesStillWanted, { member: message.member, notification: message.notification });
        if (lines === null) return null;
        return sendOnce(ctx, message.workspace, "chat.postMessage", { channel: message.user, ...messageOf(lines) }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.directMessages.deliverDirectMessage, { ...message, attempt: retry.attempt }),
    );
  },
});

function messageOf(lines: NotificationLine[]) {
  const text = lines.map(textOf).join("\n");
  return lines.some(hasButton) ? { text, blocks: lines.map(blockOf) } : { text };
}

function hasButton(line: NotificationLine) {
  return typeof line !== "string" && "action" in line;
}

function blockOf(line: NotificationLine) {
  if (typeof line !== "string" && "action" in line) return { type: "section", text: mrkdwn(line.text), accessory: buttonOf(line.action) };
  return { type: "section", text: mrkdwn(textOf(line)) };
}

function textOf(line: NotificationLine) {
  if (typeof line === "string") return line;
  return "link" in line ? slackLink(line.link) : line.text;
}
