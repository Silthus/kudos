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
      () => ctx.runMutation(internal.feedback.publicReplies.stopPosting, { reply, mayHaveLanded: false }),
    );
  },
});

async function reconcilePublicReply(ctx: ActionCtx, reply: Id<"publicReplies">, attempt: number): Promise<Retry> {
  const row = await ctx.runQuery(internal.feedback.publicReplies.desired, { reply });
  if (row === null) return null;
  if (row.shown.state === "posting") return post(ctx, row, attempt);
  if (row.shown.state === "posted") return update(ctx, row, row.shown.ts, attempt);
  return null;
}

async function post(ctx: ActionCtx, row: Doc<"publicReplies">, attempt: number): Promise<Retry> {
  const message = { channel: row.channel, text: slackTextOf(linesOf(row)), ...(row.threadTs && { thread_ts: row.threadTs }) };
  const result = await attemptCall(ctx, row.workspace, "chat.postMessage", message);
  if (result.kind === "gone" || result.kind === "unknown") {
    await ctx.runMutation(internal.feedback.publicReplies.stopPosting, { reply: row._id, mayHaveLanded: result.kind === "unknown" });
    return null;
  }
  if (result.kind !== "delivered") return retryAfter(result, attempt);
  if (result.ts === undefined) throw new Error("chat.postMessage answered without the message's ts");
  const latestVersion = await ctx.runMutation(internal.feedback.publicReplies.recordPosted, { reply: row._id, ts: result.ts });
  return againIfChanged(row, latestVersion);
}

async function update(ctx: ActionCtx, row: Doc<"publicReplies">, ts: string, attempt: number): Promise<Retry> {
  const result = await attemptCall(ctx, row.workspace, "chat.update", { channel: row.channel, ts, text: slackTextOf(linesOf(row)) });
  if (result.kind === "gone") return null;
  if (result.kind !== "delivered") return retryAfter(result, attempt);
  const latest = await ctx.runQuery(internal.feedback.publicReplies.desired, { reply: row._id });
  return againIfChanged(row, latest?.version ?? row.version);
}

function againIfChanged(delivered: Doc<"publicReplies">, latestVersion: number): Retry {
  return latestVersion === delivered.version ? null : { at: Date.now(), attempt: 1 };
}
