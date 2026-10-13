import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import type { Mention } from "../engine/messageEvent";
import { messageRefValidator } from "../engine/messageEvent";
import type { Line, Segment } from "../feedback/replies";
import { callSlack } from "./webApi";

const reactionAlreadyShown = "already_reacted";

export const deliverIndicator = internalAction({
  args: messageRefValidator,
  handler: async (ctx, ref) => {
    const indicator = await ctx.runQuery(internal.feedback.indicator.desired, ref);
    if (indicator === null) return;
    const answer = await callSlack("reactions.add", { channel: ref.conversation, timestamp: ref.message, name: indicator.emoji });
    if (!answer.ok && answer.error !== reactionAlreadyShown) console.warn(`reactions.add failed: ${answer.error}`);
  },
});

export const deliverPrivateReply = internalAction({
  args: { reply: v.id("privateReplies") },
  handler: async (ctx, { reply }) => {
    const row = await ctx.runQuery(internal.feedback.replies.privateReply, { reply });
    if (row === null) return;
    const answer = await callSlack("chat.postEphemeral", {
      channel: row.conversation,
      user: row.to,
      text: slackTextOf(row.lines),
      ...(row.threadRoot && { thread_ts: row.threadRoot }),
    });
    if (!answer.ok) console.warn(`chat.postEphemeral failed: ${answer.error}`);
  },
});

function slackTextOf(lines: Line[]) {
  return lines.map((line) => line.map(slackTextOfSegment).join("")).join("\n");
}

function slackTextOfSegment(segment: Segment) {
  return "text" in segment ? segment.text : slackMention(segment.mention);
}

function slackMention(mention: Mention) {
  if (mention.kind === "person") return `<@${mention.user}>`;
  if (mention.kind === "group") return `<!subteam^${mention.group}>`;
  return `\`@${mention.range}\``;
}
