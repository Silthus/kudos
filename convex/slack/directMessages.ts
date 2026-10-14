import { v } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { notificationValidator, type NotificationLine } from "../feedback/notify";
import { buttonOf, mrkdwn } from "./blocks";
import { attemptArgs, sendOnce, tryAtMostThreeTimes } from "./delivery";

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

export const deliverReply = observedAction({
  args: { workspace: v.string(), conversation: v.string(), text: v.string(), ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...reply }) => {
    await tryAtMostThreeTimes(
      attempt,
      (attempt) => sendOnce(ctx, reply.workspace, "chat.postMessage", { channel: reply.conversation, text: reply.text }, attempt),
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.directMessages.deliverReply, { ...reply, attempt: retry.attempt }),
    );
  },
});

function messageOf(lines: NotificationLine[]) {
  const text = lines.map(textOf).join("\n");
  return lines.every((line) => typeof line === "string") ? { text } : { text, blocks: lines.map(blockOf) };
}

function blockOf(line: NotificationLine) {
  if (typeof line === "string") return { type: "section", text: mrkdwn(line) };
  return { type: "section", text: mrkdwn(line.text), accessory: buttonOf(line.action) };
}

function textOf(line: NotificationLine) {
  return typeof line === "string" ? line : line.text;
}
