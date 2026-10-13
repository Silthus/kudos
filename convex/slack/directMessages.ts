import { v, type ObjectType } from "convex/values";
import { internal } from "../_generated/api";
import { type ActionCtx, internalAction } from "../_generated/server";
import { attemptArgs, callOnce, sendOnce, tryAtMostThreeTimes } from "./delivery";

const directMessageArgs = { workspace: v.string(), user: v.string(), lines: v.array(v.string()), conversation: v.optional(v.string()) };

type DirectMessage = ObjectType<typeof directMessageArgs>;
type OpenedConversation = { channel: { id: string } };

export const deliverDirectMessage = internalAction({
  args: { ...directMessageArgs, ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...message }) => {
    let delivery = message;
    await tryAtMostThreeTimes(
      attempt,
      async (attempt) => {
        const conversation = delivery.conversation ?? (await openConversation(ctx, delivery, attempt));
        if (typeof conversation !== "string") return conversation.retry;
        delivery = { ...delivery, conversation };
        return sendOnce(ctx, delivery.workspace, "chat.postMessage", { channel: conversation, text: delivery.lines.join("\n") }, attempt);
      },
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.directMessages.deliverDirectMessage, { ...delivery, attempt: retry.attempt }),
    );
  },
});

async function openConversation(ctx: ActionCtx, { workspace, user }: DirectMessage, attempt: number) {
  const opened = await callOnce<OpenedConversation>(ctx, workspace, "conversations.open", { users: user }, attempt);
  return "retry" in opened ? opened : opened.answered.channel.id;
}
