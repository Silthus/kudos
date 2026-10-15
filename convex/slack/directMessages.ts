import { v } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { messageRefValidator } from "../engine/messageEvent";
import { notificationValidator, type NotificationLine } from "../feedback/notify";
import { purchaseOutcomeValidator } from "../progression/purchases";
import { settingsFooterText } from "./appHomeLinks";
import { buttonOf, mrkdwn } from "./blocks";
import { attemptArgs, besideValidator, sendBesideOrAsDirectMessage, sendOnce, slackLink, tryAtMostThreeTimes } from "./delivery";

const directMessageArgs = { member: v.id("members"), workspace: v.string(), user: v.string(), notification: notificationValidator, kudos: v.optional(messageRefValidator) };

export const deliverDirectMessage = observedAction({
  args: { ...directMessageArgs, ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...message }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const lines = await ctx.runQuery(internal.feedback.notify.linesStillWanted, { member: message.member, notification: message.notification });
        if (lines === null) return null;
        const content = messageOf(lines, message.workspace);
        const beside = message.kudos === undefined ? null : await ctx.runQuery(internal.feedback.beside.placeBesideTheKudos, { member: message.member, notification: message.notification, kudos: message.kudos });
        if (beside !== null) return sendBesideOrAsDirectMessage(ctx, message.workspace, message.user, beside, content, attempt);
        return sendOnce(ctx, message.workspace, "chat.postMessage", { channel: message.user, ...content }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.directMessages.deliverDirectMessage, { ...message, attempt: retry.attempt }),
    );
  },
});

export const deliverPurchaseReply = observedAction({
  args: { member: v.id("members"), workspace: v.string(), conversation: v.string(), beside: v.optional(besideValidator), outcome: purchaseOutcomeValidator, ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...reply }) => {
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const text = await ctx.runQuery(internal.feedback.notify.purchaseReplyStillWanted, { member: reply.member, outcome: reply.outcome });
        if (text === null) return null;
        if (reply.beside !== undefined) return sendBesideOrAsDirectMessage(ctx, reply.workspace, reply.conversation, reply.beside, { text }, attempt);
        return sendOnce(ctx, reply.workspace, "chat.postMessage", { channel: reply.conversation, text }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.directMessages.deliverPurchaseReply, { ...reply, attempt: retry.attempt }),
    );
  },
});

function messageOf(lines: NotificationLine[], workspace: string) {
  const text = lines.map((line) => textOf(line, workspace)).join("\n");
  return lines.some(hasButton) ? { text, blocks: lines.map((line) => blockOf(line, workspace)) } : { text };
}

function hasButton(line: NotificationLine) {
  return typeof line !== "string" && "action" in line;
}

function blockOf(line: NotificationLine, workspace: string) {
  if (typeof line !== "string" && "action" in line) return { type: "section", text: mrkdwn(line.text), accessory: buttonOf(line.action) };
  return { type: "section", text: mrkdwn(textOf(line, workspace)) };
}

function textOf(line: NotificationLine, workspace: string) {
  if (typeof line === "string") return line;
  if ("link" in line) return slackLink(line.link);
  if ("footer" in line) return settingsFooterText(workspace, line.footer);
  return line.text;
}
