import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { observedAction } from "../analytics/boundary";
import { ReportableError } from "../analytics/exceptions";
import { linesOf } from "../feedback/publicReplies";
import { attemptArgs, attemptCall, retryAfter, slackTextOf, tryAtMostThreeTimes, type Retry } from "./delivery";

export const deliverPublicReply = observedAction({
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
  if (row.sections.length === 0) return nothingToShow(ctx, row);
  if (row.shown.state === "posting") return post(ctx, row, attempt);
  if (row.shown.state === "posted") return update(ctx, row, row.shown.ts, attempt);
  return null;
}

async function nothingToShow(ctx: ActionCtx, row: Doc<"publicReplies">): Promise<Retry> {
  if (row.shown.state === "posting") await ctx.runMutation(internal.feedback.publicReplies.stopPosting, { reply: row._id });
  return null;
}

async function post(ctx: ActionCtx, row: Doc<"publicReplies">, attempt: number): Promise<Retry> {
  if (!(await ctx.runMutation(internal.feedback.publicReplies.startSending, { reply: row._id }))) return null;
  const message = { channel: row.channel, text: slackTextOf(linesOf(row)), ...(row.threadTs && { thread_ts: row.threadTs }) };
  const result = await attemptCall<{ ts: string }>(ctx, row.workspace, "chat.postMessage", message);
  if (result.kind === "unknown") return null;
  if (result.kind === "gone") {
    await ctx.runMutation(internal.feedback.publicReplies.stopSending, { reply: row._id });
    return null;
  }
  if (result.kind !== "delivered") {
    await ctx.runMutation(internal.feedback.publicReplies.sendingFailed, { reply: row._id });
    return retryAfter(result, attempt);
  }
  const ts = result.answer.ok ? result.answer.ts : undefined;
  if (ts === undefined) throw new ReportableError("chat.postMessage answered without the message's ts");
  const latestVersion = await ctx.runMutation(internal.feedback.publicReplies.recordPosted, { reply: row._id, ts });
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
