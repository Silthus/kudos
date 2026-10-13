import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { messageRefValidator, type Mention, type MessageRef } from "../engine/messageEvent";
import type { Indicator } from "../feedback/indicator";
import type { Line, Segment } from "../feedback/replies";
import { callSlack, type SlackAnswer } from "./webApi";

export const attemptArgs = { attempt: v.optional(v.number()) };
const atMostAttempts = 3;
const longestRetryDelayMs = 60 * 60 * 1000;
const goneErrors = new Set(["message_not_found", "channel_not_found", "not_in_channel", "is_archived", "not_reactable", "invalid_name"]);
const reactionShown = new Set(["already_reacted"]);
const reactionNotShown = new Set(["no_reaction"]);

type Attempt = { kind: "delivered" } | { kind: "gone" } | { kind: "held"; until: number } | { kind: "failed"; retryAt?: number };
type Retry = { at: number; attempt: number } | null;
type Send = (attempt: number) => Promise<Retry>;

export const deliverIndicator = observedAction({
  args: { ...messageRefValidator.fields, ...attemptArgs },
  handler: async (ctx, { attempt = 1, ...ref }) => {
    const retry = await retryOnAnyError(attempt, () => reconcileIndicator(ctx, ref, attempt));
    if (retry !== null) await ctx.scheduler.runAt(retry.at, internal.slack.delivery.deliverIndicator, { ...ref, attempt: retry.attempt });
  },
});

export const deliverPrivateReply = observedAction({
  args: { reply: v.id("privateReplies"), ...attemptArgs },
  handler: async (ctx, { reply, attempt = 1 }) => {
    await tryAtMostThreeTimes(
      attempt,
      (attempt) => sendPrivateReply(ctx, reply, attempt),
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.delivery.deliverPrivateReply, { reply, attempt: retry.attempt }),
    );
  },
});

export async function tryAtMostThreeTimes(attempt: number, send: Send, tryAgain: (retry: NonNullable<Retry>) => Promise<unknown>) {
  const retry = await retryOnAnyError(attempt, () => send(attempt));
  if (retry !== null && retry.attempt <= atMostAttempts) await tryAgain(retry);
}

export async function sendOnce(ctx: ActionCtx, workspace: string, method: string, args: Record<string, unknown>, attempt: number): Promise<Retry> {
  const result = await attemptCall(ctx, workspace, method, args);
  if (result.kind === "delivered" || result.kind === "gone") return null;
  return retryAfter(result, attempt);
}

export function failedAttempt(attempt: number, retryAfterMs?: number): Retry {
  return retryAfter({ kind: "failed", ...(retryAfterMs !== undefined && { retryAt: Date.now() + retryAfterMs }) }, attempt);
}

async function reconcileIndicator(ctx: ActionCtx, ref: MessageRef, attempt: number): Promise<Retry> {
  const { indicator, version } = await ctx.runQuery(internal.feedback.indicator.desired, ref);
  const placed = await ctx.runQuery(internal.slack.placedReactions.on, ref);
  for (const step of reactionStepsTo(indicator, placed)) {
    if (step.op === "add") await ctx.runMutation(internal.slack.placedReactions.remember, { ref, emoji: step.emoji });
    const result =
      step.op === "add"
        ? await attemptCall(ctx, ref.workspace, "reactions.add", reactionArgs(ref, step.emoji), reactionShown)
        : await attemptCall(ctx, ref.workspace, "reactions.remove", reactionArgs(ref, step.emoji), reactionNotShown);
    if (result.kind === "gone") return null;
    if (result.kind !== "delivered") return retryAfter(result, attempt);
  }
  const latest = await ctx.runQuery(internal.feedback.indicator.desired, ref);
  return latest.version === version ? null : { at: Date.now(), attempt: 1 };
}

async function sendPrivateReply(ctx: ActionCtx, reply: Id<"privateReplies">, attempt: number): Promise<Retry> {
  const row = await ctx.runQuery(internal.feedback.replies.privateReply, { reply });
  if (row === null) return null;
  const message = {
    channel: row.conversation,
    user: row.to,
    text: slackTextOf(row.lines),
    ...(row.threadRoot && { thread_ts: row.threadRoot }),
  };
  return sendOnce(ctx, row.workspace, "chat.postEphemeral", message, attempt);
}

async function retryOnAnyError(attempt: number, deliver: () => Promise<Retry>): Promise<Retry> {
  try {
    return await deliver();
  } catch (error) {
    console.warn(`delivery attempt ${attempt} failed: ${String(error)}`);
    return failedAttempt(attempt);
  }
}

type ReactionStep = { op: "add" | "remove"; emoji: string };

function reactionStepsTo(desired: Indicator, placed: string[]): ReactionStep[] {
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

function retryAfter(result: { kind: "held"; until: number } | { kind: "failed"; retryAt?: number }, attempt: number): Retry {
  if (result.kind === "held") return { at: result.until, attempt };
  return { at: result.retryAt ?? Date.now() + Math.min(1000 * 2 ** attempt, longestRetryDelayMs), attempt: attempt + 1 };
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
