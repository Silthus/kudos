import { v, type Infer, type ObjectType } from "convex/values";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { intentValidator } from "../bus/commands";
import { buttonOf, mrkdwn } from "./blocks";
import { attemptArgs, callOnce, sendOnce, tryAtMostThreeTimes } from "./delivery";

const lineValidator = v.union(v.string(), v.object({ text: v.string(), action: v.object({ label: v.string(), intent: intentValidator }) }));

const directMessageArgs = { workspace: v.string(), user: v.string(), lines: v.array(lineValidator), conversation: v.optional(v.string()) };

type DirectMessage = ObjectType<typeof directMessageArgs>;
type Line = Infer<typeof lineValidator>;
type OpenedConversation = { channel: { id: string } };

export const deliverDirectMessage = observedAction({
  args: { ...directMessageArgs, ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...message }) => {
    let delivery = message;
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const conversation = delivery.conversation ?? (await openConversation(ctx, delivery, attempt));
        if (typeof conversation !== "string") return conversation.retry;
        delivery = { ...delivery, conversation };
        return sendOnce(ctx, delivery.workspace, "chat.postMessage", { channel: conversation, ...messageOf(delivery.lines) }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.directMessages.deliverDirectMessage, { ...delivery, attempt: retry.attempt }),
    );
  },
});

function messageOf(lines: Line[]) {
  const text = lines.map(textOf).join("\n");
  return lines.every((line) => typeof line === "string") ? { text } : { text, blocks: lines.map(blockOf) };
}

function blockOf(line: Line) {
  if (typeof line === "string") return { type: "section", text: mrkdwn(line) };
  return { type: "section", text: mrkdwn(line.text), accessory: buttonOf(line.action) };
}

function textOf(line: Line) {
  return typeof line === "string" ? line : line.text;
}

async function openConversation(ctx: ActionCtx, { workspace, user }: DirectMessage, attempt: number) {
  const opened = await callOnce<OpenedConversation>(ctx, workspace, "conversations.open", { users: user }, attempt);
  return "retry" in opened ? opened : opened.answered.channel.id;
}
