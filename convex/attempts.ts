import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { findMember, giveKudos, type GiveInput, type GiveResult } from "./engine";
import { type AttemptOutcome, guidance, type InvalidReason, type Problem, reactionFor } from "./lib/guidance";

/** The attempt recorded for one Slack message, if it ever carried the kudos emoji. */
export async function findAttempt(ctx: QueryCtx, workspaceId: Id<"workspaces">, channelId: string, messageTs: string) {
  return await ctx.db
    .query("kudosAttempts")
    .withIndex("by_message", (q) => q.eq("workspaceId", workspaceId).eq("channelId", channelId).eq("messageTs", messageTs))
    .unique();
}

/** How an attempt ended and, if it failed, what went wrong. `null`: it wasn't an attempt. */
function judge(result: GiveResult, input: GiveInput): { outcome: AttemptOutcome; reason?: InvalidReason; problem?: Problem } | null {
  switch (result.status) {
    case "given":
      return { outcome: "given" };
    case "limit":
      return {
        outcome: "limit",
        problem: {
          kind: "limit",
          people: result.people,
          amountEach: input.amountEach,
          remaining: result.remaining,
          limit: input.workspace.dailyLimit,
        },
      };
    case "self":
    case "invalid": {
      const reason = result.status === "self" ? "self" : result.reason;
      return { outcome: "invalid", reason, problem: { kind: reason } };
    }
    case "ignored":
      return null;
  }
}

export type Attempt = {
  id: Id<"kudosAttempts">;
  outcome: AttemptOutcome;
  /** Slack reaction name for the message. */
  reaction: string;
  /** How to fix a failed attempt, for the giver only: Slack mrkdwn and web text. */
  guidance: { slack: string; web: string } | null;
};

/**
 * Gives kudos for a message that carries the kudos emoji and records how the attempt ended,
 * so the bot can react on the message and a redelivery or an edit can find it later.
 * Not an attempt at all (a deactivated giver) → `attempt: null`.
 */
export async function attemptKudos(
  ctx: MutationCtx,
  input: GiveInput & { messageTs: string },
): Promise<{ result: GiveResult; attempt: Attempt | null }> {
  const result = await giveKudos(ctx, input);
  const verdict = judge(result, input);
  if (!verdict) return { result, attempt: null };
  const { workspace } = input;
  const giver = (await findMember(ctx, workspace, input.giverSlackId))!; // giveKudos made sure it exists
  const reaction = reactionFor(verdict.outcome, workspace.emojiName);
  const id = await ctx.db.insert("kudosAttempts", {
    workspaceId: workspace._id,
    channelId: input.channelId,
    messageTs: input.messageTs,
    giverId: giver._id,
    outcome: verdict.outcome,
    ...(verdict.reason ? { reason: verdict.reason } : {}),
    reaction,
    ...(result.status === "given" ? { batchId: result.batchId } : {}),
    at: input.now,
  });
  const problem = verdict.problem;
  return {
    result,
    attempt: {
      id,
      outcome: verdict.outcome,
      reaction,
      guidance: problem ? { slack: guidance(problem, `:${workspace.emojiName}:`), web: guidance(problem, workspace.emojiGlyph) } : null,
    },
  };
}

/** Remembers the reaction that actually landed on the message (after the ✅ fallback). */
export const setReaction = internalMutation({
  args: { id: v.id("kudosAttempts"), reaction: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, reaction }) => {
    if (await ctx.db.get(id)) await ctx.db.patch(id, { reaction });
    return null;
  },
});
