import { v } from "convex/values";
import { internal } from "../_generated/api";
import { observedAction } from "../analytics/boundary";
import { renderMondayPost } from "../feedback/mondayPost";
import type { MondayPostOutcome } from "../leaderboard/mondayPostOutcome";
import { attemptCall, slackTextOf, type Attempt } from "./delivery";

const attemptsAtMost = 3;
const refusedInChannel = new Set(["no_permission", "restricted_action", "restricted_action_read_only_channel", "restricted_action_thread_only_channel", "ekm_access_denied"]);

export const postMondayPost = observedAction({
  args: { workspace: v.string(), generation: v.number(), attempt: v.optional(v.number()) },
  handler: async (ctx, { workspace, generation, attempt = 1 }) => {
    await ctx.runMutation(internal.leaderboard.mondayPost.bookNextPost, { workspace, generation });
    const claimed = await ctx.runMutation(internal.leaderboard.mondayPost.claimWeek, { workspace, generation });
    if (claimed === null) return;
    const sent = await attemptCall(ctx, workspace, "chat.postMessage", { channel: claimed.channel, text: slackTextOf(renderMondayPost(claimed.post)) });
    const nextTry = nextTryOf(sent, attempt);
    if (nextTry !== null) await ctx.runMutation(internal.leaderboard.mondayPost.postAgainLater, { workspace, generation, claim: claimed.claim, ...nextTry });
    else await ctx.runMutation(internal.leaderboard.mondayPost.recordOutcome, { claim: claimed.claim, outcome: outcomeOf(sent) });
  },
});

function nextTryOf(sent: Attempt, attempt: number): { at: number; attempt: number } | null {
  if (sent.kind === "held") return { at: sent.until, attempt };
  if (sent.kind !== "failed" || sent.retryAt === undefined || attempt >= attemptsAtMost) return null;
  return { at: sent.retryAt, attempt: attempt + 1 };
}

function outcomeOf(sent: Attempt): MondayPostOutcome {
  if (sent.kind === "delivered") return "posted";
  return cantPostIn(sent) ? "cant-post" : "failed";
}

function cantPostIn(sent: Attempt) {
  return sent.kind === "gone" || (sent.kind === "failed" && sent.error !== undefined && refusedInChannel.has(sent.error));
}
