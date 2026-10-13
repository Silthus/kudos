import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { type ActionCtx, internalAction } from "../_generated/server";
import { linesOf } from "../feedback/publicReplies";
import { attemptArgs, attemptCall, retryAfter, slackTextOf, tryAtMostThreeTimes, type Retry } from "./delivery";

export const deliverPublicReply = internalAction({
  args: { reply: v.id("publicReplies"), ...attemptArgs },
  handler: async (ctx, { reply, attempt = 1 }) => {
    await tryAtMostThreeTimes(
      attempt,
      (attempt) => reconcilePublicReply(ctx, reply, attempt),
      (retry) => ctx.scheduler.runAt(retry.at, internal.slack.publicReplies.deliverPublicReply, { reply, attempt: retry.attempt }),
      () => ctx.runMutation(internal.feedback.publicReplies.stopPosting, { reply }),
    );
  },
});

async function reconcilePublicReply(ctx: ActionCtx, reply: Id<"publicReplies">, attempt: number): Promise<Retry> {
  const row = await ctx.runQuery(internal.feedback.publicReplies.desired, { reply });
  if (row === null) return null;
  const sent = row.postedTs === undefined ? await post(ctx, row) : await update(ctx, row, row.postedTs);
  if (sent.kind === "gone") {
    await ctx.runMutation(internal.feedback.publicReplies.stopPosting, { reply });
    return null;
  }
  if (sent.kind !== "delivered") return retryAfter(sent, attempt);
  return sent.latestVersion === row.version ? null : { at: Date.now(), attempt: 1 };
}

async function post(ctx: ActionCtx, row: Doc<"publicReplies">) {
  const message = { channel: row.channel, text: slackTextOf(linesOf(row)), ...(row.threadTs && { thread_ts: row.threadTs }) };
  const result = await attemptCall(ctx, row.workspace, "chat.postMessage", message);
  if (result.kind !== "delivered") return result;
  if (result.ts === undefined) throw new Error("chat.postMessage answered without the message's ts");
  return { kind: result.kind, latestVersion: await ctx.runMutation(internal.feedback.publicReplies.recordPosted, { reply: row._id, ts: result.ts }) };
}

async function update(ctx: ActionCtx, row: Doc<"publicReplies">, ts: string) {
  const result = await attemptCall(ctx, row.workspace, "chat.update", { channel: row.channel, ts, text: slackTextOf(linesOf(row)) });
  if (result.kind !== "delivered") return result;
  const latest = await ctx.runQuery(internal.feedback.publicReplies.desired, { reply: row._id });
  return { kind: result.kind, latestVersion: latest?.version ?? row.version };
}
