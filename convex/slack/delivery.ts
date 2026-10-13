import { v } from "convex/values";
import { internal } from "../_generated/api";
import { type ActionCtx, internalAction } from "../_generated/server";
import { messageRefValidator, type Mention, type MessageRef } from "../engine/messageEvent";
import type { Indicator } from "../feedback/indicator";
import type { Line, Segment } from "../feedback/replies";
import { callSlack, type SlackAnswer } from "./webApi";

const attemptArgs = { attempt: v.optional(v.number()) };
const privateReplyAttempts = 3;
const longestRetryDelayMs = 60 * 60 * 1000;
const goneErrors = new Set(["message_not_found", "channel_not_found", "not_in_channel"]);
const reactionShown = new Set(["already_reacted"]);
const reactionNotShown = new Set(["no_reaction"]);

type Attempt = { kind: "delivered" } | { kind: "gone" } | { kind: "held"; until: number } | { kind: "failed"; retryAt?: number };

export const deliverIndicator = internalAction({
  args: { ...messageRefValidator.fields, ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...ref }) => {
    const { indicator, version } = await ctx.runQuery(internal.feedback.indicator.desired, ref);
    const placed = await ctx.runQuery(internal.slack.placedReactions.on, ref);
    for (const step of reconcileIndicator(indicator, placed)) {
      if (step.op === "add") await ctx.runMutation(internal.slack.placedReactions.remember, { ref, emoji: step.emoji });
      const result =
        step.op === "add"
          ? await attemptCall(ctx, ref.workspace, "reactions.add", reactionArgs(ref, step.emoji), reactionShown)
          : await attemptCall(ctx, ref.workspace, "reactions.remove", reactionArgs(ref, step.emoji), reactionNotShown);
      if (result.kind === "gone") return;
      if (result.kind !== "delivered") {
        await ctx.scheduler.runAt(nextAttemptAt(result, attempt), internal.slack.delivery.deliverIndicator, { ...ref, attempt: nextAttempt(result, attempt) });
        return;
      }
      if (step.op === "remove") await ctx.runMutation(internal.slack.placedReactions.forget, { ref, emoji: step.emoji });
    }
    const latest = await ctx.runQuery(internal.feedback.indicator.desired, ref);
    if (latest.version !== version) await ctx.scheduler.runAfter(0, internal.slack.delivery.deliverIndicator, ref);
  },
});

export const deliverPrivateReply = internalAction({
  args: { reply: v.id("privateReplies"), ...attemptArgs },
  handler: async (ctx, { reply, attempt = 1 }) => {
    const row = await ctx.runQuery(internal.feedback.replies.privateReply, { reply });
    if (row === null) return;
    const result = await attemptCall(ctx, row.workspace, "chat.postEphemeral", {
      channel: row.conversation,
      user: row.to,
      text: slackTextOf(row.lines),
      ...(row.threadRoot && { thread_ts: row.threadRoot }),
    });
    if (result.kind === "delivered" || result.kind === "gone") return;
    if (result.kind === "failed" && attempt >= privateReplyAttempts) return;
    await ctx.scheduler.runAt(nextAttemptAt(result, attempt), internal.slack.delivery.deliverPrivateReply, { reply, attempt: nextAttempt(result, attempt) });
  },
});

type ReactionStep = { op: "add" | "remove"; emoji: string };

function reconcileIndicator(desired: Indicator, placed: string[]): ReactionStep[] {
  const removals = placed.filter((emoji) => emoji !== desired?.emoji).map((emoji): ReactionStep => ({ op: "remove", emoji }));
  return desired ? [...removals, { op: "add", emoji: desired.emoji }] : removals;
}

function reactionArgs(ref: MessageRef, emoji: string) {
  return { channel: ref.conversation, timestamp: ref.message, name: emoji };
}

async function attemptCall(ctx: ActionCtx, workspace: string, method: string, args: Record<string, unknown>, alsoDelivered = new Set<string>()): Promise<Attempt> {
  const until = await ctx.runQuery(internal.slack.rateLimits.heldUntil, { workspace, method });
  if (until > Date.now()) return { kind: "held", until };
  const answer = await answerOrUnknown(method, args);
  if (answer === "unknown") return { kind: "failed" };
  if (answer.ok || alsoDelivered.has(answer.error)) return { kind: "delivered" };
  if (goneErrors.has(answer.error)) return { kind: "gone" };
  console.warn(`${method} failed: ${answer.error}`);
  if (answer.retryAfterMs === undefined) return { kind: "failed" };
  const retryAt = Date.now() + answer.retryAfterMs;
  await ctx.runMutation(internal.slack.rateLimits.hold, { workspace, method, until: retryAt });
  return { kind: "failed", retryAt };
}

async function answerOrUnknown(method: string, args: Record<string, unknown>): Promise<SlackAnswer | "unknown"> {
  try {
    return await callSlack(method, args);
  } catch (error) {
    console.warn(`${method} has no known result: ${String(error)}`);
    return "unknown";
  }
}

function nextAttemptAt(result: Attempt, attempt: number) {
  if (result.kind === "held") return result.until;
  if (result.kind === "failed" && result.retryAt !== undefined) return result.retryAt;
  return Date.now() + Math.min(1000 * 2 ** attempt, longestRetryDelayMs);
}

function nextAttempt(result: Attempt, attempt: number) {
  return result.kind === "held" ? attempt : attempt + 1;
}

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
