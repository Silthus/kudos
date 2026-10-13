import { v, type ObjectType } from "convex/values";
import { internal } from "../_generated/api";
import { type ActionCtx, internalAction } from "../_generated/server";
import { attemptArgs, callOnce, sendOnce, tryAtMostThreeTimes } from "./delivery";

const directMessageArgs = { workspace: v.string(), user: v.string(), lines: v.array(v.string()) };

type DirectMessage = ObjectType<typeof directMessageArgs>;
type OpenedConversation = { channel: { id: string } };

export const deliverDirectMessage = internalAction({
  args: { ...directMessageArgs, ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...message }) => {
    await tryAtMostThreeTimes(
      attempt,
      (attempt) => sendDirectMessage(ctx, message, attempt),
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.directMessages.deliverDirectMessage, { ...message, attempt: retry.attempt }),
    );
  },
});

async function sendDirectMessage(ctx: ActionCtx, { workspace, user, lines }: DirectMessage, attempt: number) {
  const opened = await callOnce<OpenedConversation>(ctx, workspace, "conversations.open", { users: user }, attempt);
  if ("retry" in opened) return opened.retry;
  return sendOnce(ctx, workspace, "chat.postMessage", { channel: opened.answered.channel.id, text: lines.join("\n") }, attempt);
}
