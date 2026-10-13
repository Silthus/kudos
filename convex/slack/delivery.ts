import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import type { Mention } from "../engine/messageEvent";
import { messageRefValidator, type MessageRef } from "../engine/messageEvent";
import type { IndicatorState } from "../feedback/indicator";
import type { Line, Segment } from "../feedback/replies";
import { callSlack } from "./webApi";

export const deliverIndicator = internalAction({
  args: messageRefValidator,
  handler: async (ctx, ref) => {
    let applied: IndicatorState;
    let latest = await ctx.runQuery(internal.feedback.indicator.desired, ref);
    do {
      applied = latest;
      await showOnly(ref, applied);
      latest = await ctx.runQuery(internal.feedback.indicator.desired, ref);
    } while (latest.version !== applied.version);
  },
});

async function showOnly(ref: MessageRef, { desired, replaced }: IndicatorState) {
  for (const name of replaced) await react("reactions.remove", ref, name, "no_reaction");
  if (desired !== null) await react("reactions.add", ref, desired.emoji, "already_reacted");
}

async function react(method: "reactions.add" | "reactions.remove", ref: MessageRef, name: string, alreadyDone: string) {
  const answer = await callSlack(method, { channel: ref.conversation, timestamp: ref.message, name });
  if (!answer.ok && answer.error !== alreadyDone) console.warn(`${method} failed: ${answer.error}`);
}

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
